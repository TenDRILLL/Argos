import {bungieAPI} from "../automata/BungieAPI";
import {manifestCache} from "../automata/ManifestCache";
import {CharacterQuery, characterInventoryQuery, CharacterRenderData, ItemRenderData, ItemSocket, EquippedItem, ItemInstance} from "../structs/CharacterQuery";
import {UserStats} from "../structs/DBUser";
import {RawManifestQuery} from "../structs/ManifestQuery";
import {ApiResponse} from "../structs/ApiResponse";
import {sortActivities} from "./sortActivities";

const CHEST_BUCKET = 3551918588;

export function getPanelPageVariables(ID: string, d: UserStats, discordUser: any) {
    return new Promise(async (res,rej)=>{
        const characterResponse = await bungieAPI.apiRequest("getDestinyCharacters", {
            membershipType: d.membership_type,
            destinyMembershipId: d.destiny_id})
                .catch(e => rej("Failed to get characters"))
        const resp2 = (characterResponse as any).Response as CharacterQuery;
        let promises: Promise<ApiResponse>[] = [];
        resp2.characters.filter(character => !character.deleted).forEach(char => {
            promises.push(bungieAPI.apiRequest("getDestinyInventory", {
                membershipType: d.membership_type,
                destinyMembershipId: d.destiny_id,
                characterId: char.characterId}))
        })
        const characters: characterInventoryQuery[] = (await Promise.all(promises)).map(e => e.Response as characterInventoryQuery);
        const recordDefinitionPath = await bungieAPI.apiRequest("getManifests", {}).then(d => { return d.Response["jsonWorldComponentContentPaths"]["en"]["DestinyRecordDefinition"]; });
        const recordDefinitions = await bungieAPI.rawRequest(`https://www.bungie.net${recordDefinitionPath}`) as unknown as RawManifestQuery;
        const classHashes = new Map([
            [671679327, "Hunter"],
            [3655393761, "Titan"],
            [2271682572, "Warlock"]
        ]);
        const raids = sortActivities(d.raids);
        const dungeons = sortActivities(d.dungeons);
        const gms = sortActivities(d.grandmasters);

        const renderPayload = await Promise.all(characters.map(async c => {
            const equipment: EquippedItem[] = c.equipment?.data?.items ?? [];

            let primaryColor: [number, number, number, number] | null = null;

            const chestItem = equipment.find(item => item.bucketHash === CHEST_BUCKET);
            if (chestItem) {
                const gearAsset = manifestCache.getGearAsset(chestItem.itemHash);
                const gearFile: string | undefined = gearAsset?.gear?.[0];
                if (gearFile) {
                    const descriptor = await manifestCache.fetchGearDescriptor(gearFile);
                    const tint: number[] | undefined = descriptor?.default_dyes?.[0]?.material_properties?.primary_albedo_tint;
                    if (Array.isArray(tint) && tint.length >= 3) {
                        primaryColor = [tint[0], tint[1], tint[2], tint[3] ?? 1.0];
                    }
                }
            }

            const sockets = c.itemComponents?.sockets?.data ?? {};
            const visualEquipment = equipment.map(item => {
                // overrideStyleItemHash is set by Bungie when transmog is active
                const visualHash = item.overrideStyleItemHash ?? undefined;

                const itemSockets = sockets[item.itemInstanceId]?.sockets ?? [];
                const plugHashes: number[] = itemSockets
                    .filter(s => s.isEnabled && s.plugHash && s.plugHash !== item.itemHash)
                    .map(s => s.plugHash as number);

                return { ...item, ...(visualHash ? { visualHash } : {}), plugHashes };
            });

            return {
                characterId: c.character.data.characterId,
                classType: c.character.data.classType,
                characterRenderData: c.characterRenderData?.data ?? null,
                equipment: visualEquipment,
                itemComponents: c.itemComponents ?? null,
                primaryColor,
                stats: c.character.data.stats ?? {},
            };
        }));

        res({DBData: d, characters, recordDefinitions, classHashes, raids, dungeons, gms, discordUser, renderPayload})
    })
}
