import {bungieAPI} from "../automata/BungieAPI";
import {CharacterQuery, characterInventoryQuery} from "../structs/CharacterQuery";
import {UserStats} from "../structs/DBUser";
import {RawManifestQuery} from "../structs/ManifestQuery";
import {ApiResponse} from "../structs/ApiResponse";
import {sortActivities} from "./sortActivities";

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
        res({DBData: d, characters, recordDefinitions, classHashes, raids, dungeons, gms, discordUser})
    })
}
