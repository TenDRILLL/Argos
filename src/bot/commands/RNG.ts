import DiscordCommand from "../../structs/DiscordCommand";
import {
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    Client,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from "discord.js";
import { dbQuery } from "../../automata/Database";
import { bungieAPI } from "../../automata/BungieAPI";
import { manifestCache } from "../../automata/ManifestCache";

const KINETIC = 1498876634;
const ENERGY  = 2465295065;
const POWER   = 953998645;
const VAULT   = 138197802;
const WEAPON_BUCKETS   = new Set([KINETIC, ENERGY, POWER]);
const AMMO_SPECIAL     = 2;
const TIER_EXOTIC      = 6;
const ITEM_TYPE_WEAPON = 3;

const AMMO_LABELS: Record<number, string> = { 1: "Primary", 2: "Special", 3: "Heavy" };
const TIER_LABELS: Record<number, string>  = { 6: "Exotic", 5: "Legendary", 4: "Rare", 3: "Uncommon", 2: "Common" };
const SLOT_NAMES: Record<number, string>   = { [KINETIC]: "Kinetic", [ENERGY]: "Energy", [POWER]: "Power" };

interface WeaponInstance {
    instanceId: string;
    charId: string | null;
    equipped: boolean;
}

interface Weapon {
    itemHash: number;
    instances: WeaponInstance[];
    name: string;
    icon: string | null;
    ammoType: number;
    tierType: number;
    slot: number;
}

interface SlotEntry {
    itemHash: number;
    name: string;
    ammoType: number;
    tierType: number;
    instances: WeaponInstance[];
}

interface PendingLoadout {
    membershipType: number;
    destinyId: string;
    targetCharId: string;
    kinetic: SlotEntry | null;
    energy:  SlotEntry | null;
    power:   SlotEntry | null;
}

export const pending = new Map<string, PendingLoadout>();

function pick<T>(arr: T[]): T | null {
    return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

async function resolveDef(hash: number): Promise<any | null> {
    let def = manifestCache.getItemDef(hash);
    if (!def) {
        try {
            const resp = await bungieAPI.apiRequest("getDestinyEntityDefinition", {
                entityType: "DestinyInventoryItemDefinition",
                hashIdentifier: hash,
            });
            def = (resp as any).Response;
            if (def) manifestCache.cacheItemDef(hash, def);
        } catch { return null; }
    }
    return def ?? null;
}

async function getAccessToken(discordId: string): Promise<string | null> {
    const rows = await dbQuery(
        "SELECT access_token, access_expiry, refresh_token, refresh_expiry FROM user_tokens WHERE discord_id = ?",
        [discordId]
    );
    if (!rows.length) return null;

    let { access_token, access_expiry, refresh_token, refresh_expiry } = rows[0];
    if (Date.now() > Number(access_expiry) - 300_000) {
        const auth = await bungieAPI.refreshToken(refresh_token, Number(refresh_expiry));
        access_token = auth.access_token;
        const now = Date.now();
        await dbQuery(
            "UPDATE user_tokens SET access_token=?, access_expiry=?, refresh_token=?, refresh_expiry=? WHERE discord_id=?",
            [auth.access_token, now + auth.expires_in * 1000, auth.refresh_token, now + auth.refresh_expires_in * 1000, discordId]
        );
    }
    return access_token as string;
}

export default class RNG extends DiscordCommand {
    constructor() {
        super("rng", { name: "rng", description: "Roll a random weapon loadout from your inventory." });
    }

    private async buildRNG(discordId: string, client: Client<true>): Promise<{ container: ContainerBuilder; loadout: PendingLoadout }> {
        const rows = await dbQuery(
            `SELECT u.destiny_id, u.membership_type,
                    t.access_token, t.access_expiry, t.refresh_token, t.refresh_expiry
             FROM users u JOIN user_tokens t ON u.discord_id = t.discord_id
             WHERE u.discord_id = ?`,
            [discordId]
        );
        if (!rows.length) throw new Error("You're not registered.");

        let { destiny_id, membership_type, access_token, access_expiry, refresh_token, refresh_expiry } = rows[0];

        if (Date.now() > Number(access_expiry) - 300_000) {
            const auth = await bungieAPI.refreshToken(refresh_token, Number(refresh_expiry));
            access_token = auth.access_token;
            const now = Date.now();
            await dbQuery(
                "UPDATE user_tokens SET access_token=?, access_expiry=?, refresh_token=?, refresh_expiry=? WHERE discord_id=?",
                [auth.access_token, now + auth.expires_in * 1000, auth.refresh_token, now + auth.refresh_expires_in * 1000, discordId]
            );
        }

        let profileData: any;
        try {
            profileData = await bungieAPI.apiRequest(
                "getProfileInventory",
                { membershipType: membership_type, destinyMembershipId: destiny_id },
                { Authorization: `Bearer ${access_token}` }
            );
        } catch {
            throw new Error("Failed to fetch inventory from Bungie.");
        }

        const resp = (profileData as any).Response;

        // Pick most recently active character as equip target
        const charData: Record<string, any> = resp.characters?.data ?? {};
        let targetCharId = Object.keys(charData)[0] ?? "";
        let latestDate = 0;
        for (const [cid, cdat] of Object.entries(charData)) {
            const t = new Date(cdat.dateLastPlayed ?? 0).getTime();
            if (t > latestDate) { latestDate = t; targetCharId = cid; }
        }

        // Collect weapon instances grouped by itemHash
        const instancesByHash = new Map<number, WeaponInstance[]>();
        const slotByHash = new Map<number, number>();

        for (const compKey of ["characterInventories", "characterEquipment"]) {
            const equipped = compKey === "characterEquipment";
            for (const [charId, charDat] of Object.entries((resp[compKey]?.data ?? {}) as Record<string, any>)) {
                for (const item of (charDat.items ?? []) as any[]) {
                    const bh: number = item.bucketHash;
                    if (!WEAPON_BUCKETS.has(bh)) continue;
                    if (!instancesByHash.has(item.itemHash)) instancesByHash.set(item.itemHash, []);
                    instancesByHash.get(item.itemHash)!.push({ instanceId: item.itemInstanceId, charId, equipped });
                    slotByHash.set(item.itemHash, bh);
                }
            }
        }

        for (const item of (resp.profileInventory?.data?.items ?? []) as any[]) {
            if (item.bucketHash !== VAULT) continue;
            if (!instancesByHash.has(item.itemHash)) instancesByHash.set(item.itemHash, []);
            instancesByHash.get(item.itemHash)!.push({ instanceId: item.itemInstanceId, charId: null, equipped: false });
        }

        // Resolve defs in parallel
        const allHashes = [...instancesByHash.keys()];
        const defPairs = await Promise.all(allHashes.map(async h => [h, await resolveDef(h)] as [number, any]));
        const defMap = new Map(defPairs.filter(([, d]) => d !== null));

        // Build weapon pool
        const weapons: Weapon[] = [];
        for (const [hash, instances] of instancesByHash) {
            const def = defMap.get(hash);
            if (!def || def.itemType !== ITEM_TYPE_WEAPON) continue;

            let slot = slotByHash.get(hash);
            if (slot === undefined) {
                const defSlot: number = def.inventory?.bucketTypeHash;
                if (!WEAPON_BUCKETS.has(defSlot)) continue;
                slot = defSlot;
            }

            weapons.push({
                itemHash: hash,
                instances,
                name: def.displayProperties?.name ?? "Unknown",
                icon: def.displayProperties?.icon ?? null,
                ammoType: def.equippingBlock?.ammoType ?? 0,
                tierType: def.inventory?.tierType ?? 0,
                slot,
            });
        }

        const kinetic = weapons.filter(w => w.slot === KINETIC);
        const energy  = weapons.filter(w => w.slot === ENERGY);
        const power   = weapons.filter(w => w.slot === POWER);

        if (!kinetic.length && !energy.length && !power.length) {
            throw new Error("No weapons found in your inventory.");
        }

        let kPick = pick(kinetic);
        let ePick = pick(energy);
        let pPick = pick(power);

        // At most one special-ammo weapon in kinetic + energy
        if (kPick?.ammoType === AMMO_SPECIAL && ePick?.ammoType === AMMO_SPECIAL) {
            if (Math.random() < 0.5) {
                const pool = kinetic.filter(w => w.ammoType !== AMMO_SPECIAL);
                if (pool.length) kPick = pick(pool);
            } else {
                const pool = energy.filter(w => w.ammoType !== AMMO_SPECIAL);
                if (pool.length) ePick = pick(pool);
            }
        }

        // At most one exotic across all slots
        const slotState = [
            { pick: kPick, pool: kinetic },
            { pick: ePick, pool: energy  },
            { pick: pPick, pool: power   },
        ];
        const exoticIdxs = slotState.reduce<number[]>((a, s, i) => {
            if (s.pick?.tierType === TIER_EXOTIC) a.push(i);
            return a;
        }, []);
        if (exoticIdxs.length > 1) {
            const keep = exoticIdxs[Math.floor(Math.random() * exoticIdxs.length)];
            for (const i of exoticIdxs) {
                if (i === keep) continue;
                const pool = slotState[i].pool.filter(w => w.tierType !== TIER_EXOTIC);
                if (pool.length) slotState[i].pick = pick(pool);
            }
            kPick = slotState[0].pick;
            ePick = slotState[1].pick;
            pPick = slotState[2].pick;
        }

        const toSlotEntry = (w: Weapon | null): SlotEntry | null => w ? {
            itemHash: w.itemHash,
            name: w.name,
            ammoType: w.ammoType,
            tierType: w.tierType,
            instances: w.instances,
        } : null;

        const loadout: PendingLoadout = {
            membershipType: membership_type,
            destinyId: destiny_id,
            targetCharId,
            kinetic: toSlotEntry(kPick),
            energy:  toSlotEntry(ePick),
            power:   toSlotEntry(pPick),
        };

        let buttonEmoji: { id: string; name: string | undefined } | undefined;
        let exoticEmojiStr: string | undefined;
        const ammoEmojiStr: Record<number, string> = {};
        try {
            const appEmojis = await client.application!.emojis.fetch();
            const emojiArr = [...appEmojis.values()];
            const e = emojiArr[1] ?? emojiArr[0];
            if (e) buttonEmoji = { id: e.id!, name: e.name ?? undefined };
            const exoticEmoji = appEmojis.find(em => em.name === "exotic");
            if (exoticEmoji) exoticEmojiStr = `<:${exoticEmoji.name}:${exoticEmoji.id}>`;
            // ammo type 1=Primary, 2=Special(energy), 3=Heavy
            for (const [ammoType, emojiName] of [[1, "primary"], [2, "energy"], [3, "heavy"]] as [number, string][]) {
                const em = appEmojis.find(x => x.name === emojiName);
                if (em) ammoEmojiStr[ammoType] = `<:${em.name}:${em.id}>`;
            }
        } catch { /* no emoji */ }

        const textLine = (w: Weapon | null, slotName: string): string => {
            if (!w) return `-# **${slotName}** · No weapons found`;
            const ammoLabel = AMMO_LABELS[w.ammoType] ?? "Unknown";
            const ammoStr = ammoEmojiStr[w.ammoType] ? `${ammoEmojiStr[w.ammoType]} ${ammoLabel}` : ammoLabel;
            const tierLabel = TIER_LABELS[w.tierType] ?? "Unknown";
            const tierStr = w.tierType === TIER_EXOTIC && exoticEmojiStr
                ? `${exoticEmojiStr} ${tierLabel}`
                : tierLabel;
            return `**${SLOT_NAMES[w.slot]}** · ${w.name}\n-# ${ammoStr} · ${tierStr}`;
        };

        const equipBtn = new ButtonBuilder()
            .setLabel("Equip")
            .setStyle(ButtonStyle.Success)
            .setCustomId(`rng-equip-${discordId}`);
        if (buttonEmoji) equipBtn.setEmoji(buttonEmoji);

        const rerollBtn = new ButtonBuilder()
            .setLabel("Reroll")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji({ name: "🔁" })
            .setCustomId(`rng-reroll-${discordId}`);

        const deleteBtn = new ButtonBuilder()
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger)
            .setEmoji({ name: "🗑️" })
            .setCustomId(`delete-${discordId}`);

        const bungieRoot = "https://www.bungie.net";
        const gallery = new MediaGalleryBuilder();
        if (kPick?.icon) gallery.addItems(new MediaGalleryItemBuilder().setURL(`${bungieRoot}${kPick.icon}`).setDescription(kPick.name));
        if (ePick?.icon) gallery.addItems(new MediaGalleryItemBuilder().setURL(`${bungieRoot}${ePick.icon}`).setDescription(ePick.name));

        const container = new ContainerBuilder()
            .setAccentColor(0xae27ff)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent("### RNG Loadout"))
            .addMediaGalleryComponents(gallery)
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(textLine(kPick, "Kinetic")))
                    .setButtonAccessory(equipBtn)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(textLine(ePick, "Energy")))
                    .setButtonAccessory(rerollBtn)
            )
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(textLine(pPick, "Power")))
                    .setButtonAccessory(deleteBtn)
            );

        return { container, loadout };
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        try {
            const { container, loadout } = await this.buildRNG(interaction.user.id, interaction.client);
            pending.set(interaction.user.id, loadout);
            return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            return interaction.editReply({ content: e instanceof Error ? e.message : "Something went wrong." });
        }
    }

    async button(interaction: ButtonInteraction) {
        const parts = interaction.customId.split("-");
        const action = parts[1];
        const ownerId = parts[2];
        const discordId = interaction.user.id;

        if (action === "reroll") {
            if (ownerId !== discordId) {
                return interaction.reply({ content: "The loadouts are specifically tied to the Guardians of the command user, please use `/rng` to generate your own.", flags: MessageFlags.Ephemeral });
            }
            await interaction.deferUpdate();
            try {
                const { container, loadout } = await this.buildRNG(discordId, interaction.client);
                pending.set(discordId, loadout);
                return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } catch (e) {
                return interaction.editReply({ content: e instanceof Error ? e.message : "Something went wrong." });
            }
        }

        // equip
        if (ownerId !== discordId) {
            return interaction.reply({ content: "The loadouts are specifically tied to the Guardians of the command user, please use `/rng` to generate your own.", flags: MessageFlags.Ephemeral });
        }

        const loadout = pending.get(discordId);
        if (!loadout) {
            return interaction.reply({ content: "Loadout expired. Re-roll with `/rng`.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let access_token: string | null;
        try {
            access_token = await getAccessToken(discordId);
        } catch {
            return interaction.editReply({ content: "Token refresh failed." });
        }
        if (!access_token) return interaction.editReply({ content: "Not registered." });

        const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };
        const { membershipType, destinyId } = loadout;

        // Check online status and resolve current character.
        // Bungie only populates profileTransitoryData (component 1000) when the player
        // is in-game with a character loaded. Absent = offline or in character select.
        let equipCharId = loadout.targetCharId;
        try {
            const statusResp = await bungieAPI.apiRequest(
                "getProfileTransitory",
                { membershipType, destinyMembershipId: destinyId },
                { Authorization: `Bearer ${access_token}` }
            );
            const status = (statusResp as any).Response;
            const transitory = status?.profileTransitoryData?.data;

            if (!transitory) {
                // Absent transitory data means either offline or sitting in character select.
                // Check if any character shows currentActivityHash = 0 across the board,
                // which can happen in character select (no activity started this session yet).
                const charActs: Record<string, any> = status?.characterActivities?.data ?? {};
                const allIdle = Object.values(charActs).every(
                    (c: any) => !c.currentActivityHash || c.currentActivityHash === 0
                );
                if (allIdle && Object.keys(charActs).length > 0) {
                    return interaction.editReply({ content: "No character selected — pick a Guardian in-game first." });
                }
                return interaction.editReply({ content: "Your Guardian is offline. Launch Destiny 2 and load into a character first." });
            }

            // Resolve current character: the one with the most recent activity start.
            const charActs: Record<string, any> = status?.characterActivities?.data ?? {};
            let latestMs = 0;
            for (const [cid, cdat] of Object.entries(charActs)) {
                const ms = new Date((cdat as any).dateActivityStarted ?? 0).getTime();
                if (ms > latestMs) { latestMs = ms; equipCharId = cid; }
            }
        } catch {
            // Status check failed — fall through and attempt equip with stored targetCharId.
        }

        const toEquip: string[] = [];
        const results: string[] = [];

        for (const [slotName, slot] of [
            ["Kinetic", loadout.kinetic],
            ["Energy",  loadout.energy],
            ["Power",   loadout.power],
        ] as [string, SlotEntry | null][]) {
            if (!slot) continue;

            // Prefer: on current char > vault > other char inventory; skip equipped-on-other-char
            const onTarget = slot.instances.find(i => i.charId === equipCharId);
            const inVault  = slot.instances.find(i => i.charId === null);
            const otherInv = slot.instances.find(i => i.charId !== null && i.charId !== equipCharId && !i.equipped);
            const best = onTarget ?? inVault ?? otherInv;

            if (!best) {
                results.push(`${slotName}: **${slot.name}** is equipped on another character — move it to vault first.`);
                continue;
            }

            try {
                if (best.charId !== equipCharId) {
                    if (best.charId !== null) {
                        await bungieAPI.apiRequest("transferItem", {}, headers, "post", {
                            itemReferenceHash: slot.itemHash,
                            stackSize: 1,
                            itemId: best.instanceId,
                            characterId: best.charId,
                            membershipType,
                            transferToVault: true,
                        });
                    }
                    await bungieAPI.apiRequest("transferItem", {}, headers, "post", {
                        itemReferenceHash: slot.itemHash,
                        stackSize: 1,
                        itemId: best.instanceId,
                        characterId: equipCharId,
                        membershipType,
                        transferToVault: false,
                    });
                }
                toEquip.push(best.instanceId);
            } catch {
                results.push(`${slotName}: **${slot.name}** — transfer failed.`);
            }
        }

        if (toEquip.length) {
            try {
                await bungieAPI.apiRequest("equipItems", {}, headers, "post", {
                    itemIds: toEquip,
                    characterId: equipCharId,
                    membershipType,
                });
                results.push(`Equipped ${toEquip.length} weapon(s) on your active Guardian.`);
            } catch {
                results.push("Equip failed — make sure your Guardian is in orbit or a social space.");
            }
        }

        pending.delete(discordId);
        return interaction.editReply({ content: results.length ? results.join("\n") : "Nothing to equip." });
    }
}
