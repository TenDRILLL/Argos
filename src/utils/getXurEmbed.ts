import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { bungieAPI } from "../automata/BungieAPI";
import { dbQuery } from "../automata/Database";
import { userService } from "../automata/UserService";
import { VendorQuery, SocketComponents } from "../structs/VendorQuery";
import { CharacterQuery } from "../structs/CharacterQuery";
import { EntityQuery, RawEntityQuery, DisplayProperties } from "../structs/EntityQuery";
import { WeaponSlot } from "../enums/WeaponSlot";

export const XUR_CHANNEL_ID = process.env.XUR_CHANNEL_ID ?? "980143760149188648";

export async function getXurEmbed(client: Client): Promise<EmbedBuilder> {
    const adminId = process.env.ADMIN_USER_ID as string;

    const accessToken = await userService.getAdminBungieToken(adminId);

    const userRows = await dbQuery("SELECT * FROM users WHERE discord_id = ?", [adminId]);
    if (!userRows.length) throw new Error("Admin user not in DB");
    const adminUser = userRows[0];

    const charData = await bungieAPI.apiRequest("getDestinyCharacters", {
        membershipType: 3,
        destinyMembershipId: adminUser.destiny_id
    });
    const resp = charData.Response as CharacterQuery;

    const vendorData = await bungieAPI.apiRequest("getVendorInformation", {
        membershipType: 3,
        destinyMembershipId: adminUser.destiny_id,
        characterId: resp.characters.filter(c => !c.deleted)[0].characterId,
        vendorHash: "2190858386"
    }, { "Authorization": `Bearer ${accessToken}` });

    const info = vendorData.Response as VendorQuery;
    const location = info.vendor.data.vendorLocationIndex;
    const statHashes = ["2996146975", "392767087", "1943323491", "1735777505", "144602215", "4244567218"];

    const salesData = info.sales.data as any;
    const socketsData = (info.itemComponents.sockets.data as any);
    const statsData = (info.itemComponents.stats.data as any);

    const data = info.categories.data.categories[0].itemIndexes
        .concat(info.categories.data.categories[1].itemIndexes)
        .filter(e => e != 0)
        .filter(index => salesData[index] && socketsData[index] && statsData[index])
        .map(index => ({
            itemHash: salesData[index].itemHash as number,
            sockets: socketsData[index].sockets as SocketComponents[],
            stats: statHashes.map(h => statsData[index]?.stats[h]?.value as number)
        }));

    return generateEmbed(data, client, location);
}

export async function generateXurEmbed(client: Client): Promise<void> {
    const rows = await dbQuery("SELECT value FROM misc WHERE key_name = 'xurEmbed'");
    if (rows.length) {
        console.log("XUR embed exists.");
        return;
    }
    console.log(`Generating XUR embed: ${new Date().toISOString()}`);
    const embed = await getXurEmbed(client).catch(e => {
        console.log(`Xur isn't anywhere / something went wrong ${e}`);
        return null;
    });
    if (!embed) return;
    const embedJson = JSON.stringify(embed.toJSON());
    await dbQuery(
        "INSERT INTO misc (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
        ["xurEmbed", embedJson, embedJson]
    );
    console.log("XUR embed saved.");
    if (process.env.NODE_ENV === "production") {
        const channel = client.channels.cache.get(XUR_CHANNEL_ID) as TextChannel | undefined;
        channel?.send({ embeds: [embed] }).catch(e => console.log(e));
    }
}

const PROTECTED_EMOJI_NAMES = new Set([
    "warlock2", "titan2", "hunter2",
    "first", "second", "third",
    "mobility", "resilience", "recovery",
    "discipline", "intellect", "strength",
    "Xbox", "PlayStation", "Steam", "EpicGames",
]);

export async function deleteXurEmbed(client: Client): Promise<void> {
    const rows = await dbQuery("SELECT value FROM misc WHERE key_name = 'xurEmbed'");
    if (!rows.length) return;
    console.log(`Deleting XUR embed and emojis: ${new Date().toISOString()}`);
    await dbQuery("DELETE FROM misc WHERE key_name = 'xurEmbed'");
    const emojis = await client.application!.emojis.fetch();
    for (const [, emoji] of emojis) {
        if (PROTECTED_EMOJI_NAMES.has(emoji.name!)) continue;
        await client.application!.emojis.delete(emoji.id).catch(() => null);
    }
}

async function generateEmbed(
    components: { itemHash: number; sockets: SocketComponents[]; stats: number[] }[],
    client: Client,
    locationIndex: number
): Promise<EmbedBuilder> {
    const promises = components.map(item =>
        new Promise<EntityQuery>(res => {
            getWeaponInfo(item.itemHash).then(d => res(d));
        })
    );
    const data = await Promise.all(promises);
    const xurLocations = ["Hangar, The Tower", "Winding Cove, EDZ", "Watcher's Grave, Nessus"];
    const fields = await generateFields(data, components, client);
    return new EmbedBuilder()
        .setTitle(`Xûr is at ${xurLocations[locationIndex]}`)
        .setColor(0xAE27FF)
        .setDescription("He is currently selling the following exotics")
        .setFields(fields);
}

async function generateFields(
    exotics: EntityQuery[],
    components: { itemHash: number; sockets: SocketComponents[]; stats: number[] }[],
    client: Client
): Promise<{ name: string; value: string; inline?: boolean }[]> {
    const manifest = await bungieAPI.apiRequest("getManifests", {});
    const path = (manifest.Response as any)["jsonWorldComponentContentPaths"]["en"]["DestinyInventoryItemDefinition"];
    const InventoryItemDefinition = await bungieAPI.rawRequest(`https://www.bungie.net${path}`) as unknown as RawEntityQuery;

    const fetchedEmojis = await client.application!.emojis.fetch();
    const findEmoji = (name: string) => fetchedEmojis.find(e => e.name === name)?.toString() ?? "";

    const classTypes: Map<number, string> = new Map([
        [3, ""],
        [1, findEmoji("hunter2")],
        [0, findEmoji("titan2")],
        [2, findEmoji("warlock2")]
    ]);
    const statEmojis = [
        findEmoji("mobility"),
        findEmoji("resilience"),
        findEmoji("recovery"),
        findEmoji("discipline"),
        findEmoji("intellect"),
        findEmoji("strength")
    ];

    const exoticPromises = exotics.map(exotic => new Promise<{ name: string; value: string; inline?: boolean }>(async res => {
        const component = components.find(e => e.itemHash === exotic.hash)!;
        const icons: DisplayProperties[] = [];
        const val: { name: string; value: string; inline?: boolean } = {
            name: exotic.displayProperties.name,
            value: `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}`,
            inline: true
        };
        icons.push(exotic.displayProperties);

        if (WeaponSlot.weapons.includes(exotic.equippingBlock.equipmentSlotTypeHash)) {
            exotic.sockets.socketCategories[0].socketIndexes.forEach(e => {
                const perk = InventoryItemDefinition[component.sockets[e].plugHash];
                if (!perk.displayProperties.name.includes("Tracker")) {
                    icons.push(perk.displayProperties);
                }
            });
            exotic.sockets.socketCategories[1].socketIndexes.forEach(e => {
                const perk = InventoryItemDefinition[component.sockets[e].plugHash];
                if (!perk.displayProperties.name.includes("Tracker")) {
                    icons.push(perk.displayProperties);
                }
            });
        } else {
            val.value += "\n";
            component.stats.forEach((e, i) => {
                val.value += `${statEmojis[i]} ${e.toString().padEnd(3, " ")}`;
                if (i == 2) val.value += "\n";
            });
            val.value += `\nTotal: ${component.stats.reduce((a, b) => a + b)}`;
        }

        const iconNames: string[] = [];
        for (const icon of icons) {
            const cleanName = icon.name.replace(/[^0-9A-z ]/g, "").split(" ").join("_");
            const emoji = fetchedEmojis.find(e => e.name === cleanName);
            if (!emoji) {
                const created = await client.application!.emojis.create({
                    name: cleanName,
                    attachment: `https://bungie.net${icon.icon}`
                }).catch(() => null);
                if (created) iconNames.push(created.toString());
            } else {
                iconNames.push(emoji.toString());
            }
        }

        val.name = `${iconNames[0]} ${val.name}`;
        iconNames.shift();
        val.value += `\n    ${iconNames.join(" ")}`;
        res(val);
    }));

    let rows = await Promise.all(exoticPromises);
    rows.sort((a, b) => a.value.length - b.value.length);
    rows = rows.map((e, i) => { if (i < 3) { e.value += "\n​"; } return e; });
    return rows;
}

async function getWeaponInfo(weaponID: number): Promise<EntityQuery> {
    return new Promise<EntityQuery>(res => {
        bungieAPI.apiRequest("getDestinyEntityDefinition", { entityType: "DestinyInventoryItemDefinition", hashIdentifier: weaponID }).then(u => {
            res(u.Response as EntityQuery);
        }).catch(e => console.log(e));
    });
}
