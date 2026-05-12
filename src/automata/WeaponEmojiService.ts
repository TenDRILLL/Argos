import { Client } from "discord.js";
import { bungieAPI } from "./BungieAPI";
import { RAID_GROUPS, weaponEmojiName } from "../enums/raidWeaponPatterns";

export class WeaponEmojiService {
    private emojiMap: Map<string, string> = new Map();
    private syncing = false;

    isSyncing(): boolean { return this.syncing; }

    async syncEmojis(client: Client): Promise<void> {
        this.syncing = true;
        try {
            const manifest = await bungieAPI.apiRequest("getManifests", {});
            const resp = manifest.Response as any;
            const itemPath: string | undefined = resp?.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemDefinition;
            if (!itemPath) {
                console.error("WeaponEmojiService: DestinyInventoryItemDefinition path missing from manifest");
                return;
            }

            console.log("WeaponEmojiService: downloading DestinyInventoryItemDefinition...");
            const defs = await bungieAPI.rawRequest(`https://www.bungie.net${itemPath}`) as Record<string, any>;

            const weaponNames = new Set(RAID_GROUPS.flatMap(r => r.weapons.map(w => w.name)));
            const iconMap = new Map<string, string>();

            for (const def of Object.values(defs)) {
                const name: string = def?.displayProperties?.name ?? "";
                if (!weaponNames.has(name) || iconMap.has(name)) continue;
                const icon: string = def?.displayProperties?.icon ?? "";
                if (icon) iconMap.set(name, icon);
            }

            const existingEmojis = await client.application!.emojis.fetch();

            const weapons = RAID_GROUPS.flatMap(r => r.weapons);
            const total = weapons.length;
            let synced = 0;

            for (const weapon of weapons) {
                const emojiName = weaponEmojiName(weapon.name);
                const existing = existingEmojis.find(e => e.name === emojiName);
                if (existing) {
                    this.emojiMap.set(weapon.name, existing.toString());
                    synced++;
                    continue;
                }
                const icon = iconMap.get(weapon.name);
                if (!icon) {
                    console.warn(`WeaponEmojiService: no icon found for "${weapon.name}"`);
                    continue;
                }
                const created = await client.application!.emojis.create({
                    name: emojiName,
                    attachment: `https://bungie.net${icon}`,
                }).catch(e => {
                    console.error(`WeaponEmojiService: failed to create emoji "${emojiName}":`, e);
                    return null;
                });
                if (created) {
                    this.emojiMap.set(weapon.name, created.toString());
                    synced++;
                }
            }

            console.log(`WeaponEmojiService: synced ${synced} / ${total} weapon emojis`);
        } finally {
            this.syncing = false;
        }
    }

    getWeaponEmoji(weaponName: string): string {
        return this.emojiMap.get(weaponName) ?? "";
    }
}

export const weaponEmojiService = new WeaponEmojiService();
