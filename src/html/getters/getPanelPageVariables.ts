import { APIResponse } from "../../props/apiResponse";
import { CharacterQuery, characterInventoryQuery } from "../../props/characterQuery";
import { DBUser } from "../../props/dbUser";
import { RawManifestQuery } from "../../props/manifest";
import { sortActivities } from "../../utils/sortActivities";

export function getPanelPageVariables(d2client, ID, d, discordUser) {
    return new Promise(async (res,rej)=>{
        const DBData = d as DBUser;
        const characterResponse = await d2client.apiRequest("getDestinyCharacters", {
            membershipType: DBData.membershipType,
            destinyMembershipId: DBData.destinyId})
        const resp2 = characterResponse.Response as CharacterQuery;
        let promises: Promise<APIResponse>[] = [];
        resp2.characters.filter(character => !character.deleted).forEach(char => {
            promises.push(d2client.apiRequest("getDestinyInventory", {
                membershipType: DBData.membershipType,
                destinyMembershipId: DBData.destinyId,
                characterId: char.characterId}))
        })
        const characters: characterInventoryQuery[] = (await Promise.all(promises)).map(e => e.Response as characterInventoryQuery);
        const recordDefinitionPath = await d2client.apiRequest("getManifests", {}).then(d => { return d.Response["jsonWorldComponentContentPaths"]["en"]["DestinyRecordDefinition"]; });
        const recordDefinitions = await d2client.rawRequest(`https://www.bungie.net${recordDefinitionPath}`) as RawManifestQuery;
        const classHashes = new Map([
            [671679327, "Hunter"],
            [3655393761, "Titan"],
            [2271682572, "Warlock"]
        ]);
        const raids = sortActivities(DBData.raids);
        const dungeons = sortActivities(DBData.dungeons);
        const gms = sortActivities(DBData.grandmasters);
        res({DBData, characters, recordDefinitions, classHashes, raids, dungeons, gms, discordUser})
    })
}