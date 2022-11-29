import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import {CharacterQuery} from "./props/characterQuery";
import {weaponDatabaseObject, WeaponQuery} from "./props/weaponQuery";
import {weaponNameQuery} from "./props/weaponNameQuery";
import {ManifestActivity, ManifestActivityQuery, ManifestQuery} from "./props/manifest";

const d2client = new requestHandler(process.env.apikey);
const dcclient = new discordHandler();

d2client.apiRequest("getManifests",{}).then(d => {
    const resp = d.Response as ManifestQuery;
    const enManifest = resp.jsonWorldComponentContentPaths.en["DestinyActivityDefinition"];
    d2client.rawRequest(`https://www.bungie.net${enManifest}`).then(e => {
        const activities = e as unknown as ManifestActivityQuery;
        const values: ManifestActivity[] = Object.values(activities);
        console.log(values[0]);
        values.forEach(x => {
            if ([608898761/*dungeon*/, 2043403989/*raid*/].includes(x.activityTypeHash)) {}
        })
   //     values.filter(x => [608898761/*dungeon*/, 2043403989/*raid*/].includes(x.activityTypeHash)).forEach(q => {
     //       const saved = activityIdentifierDB.get(normalizeActivityName(q.displayProperties.name)) as activityIdentifierObject ?? {IDs: []};
       //     if (!saved.IDs.includes(q.hash)) {
         //       saved.IDs.push(q.hash);
           //     activityIdentifierDB.set(normalizeActivityName(q.displayProperties.name), saved)
           // }
    //    });
    });
});
//console.log(activityIdentifierDB.get("Vow of the Disciple, Master"));

function instantiateWeaponDatabase() {
    const destinyMembershipId = "4611686018468779813";
    const beingChecked: number[] = []
    d2client.apiRequest("getDestinyCharacters", {destinyMembershipId: destinyMembershipId, membershipType: 3}).then(d => {
        const resp = d.Response as CharacterQuery;
        resp.characters.forEach(e => {
            const characterId = e.characterId;
            d2client.apiRequest("getWeaponStats",{membershipType: 3, destinyMembershipId: destinyMembershipId, characterId: characterId}).then(v => {
                const resp2 = v.Response as WeaponQuery;
                let i = 0;
                resp2.weapons.forEach(async weapon => {
                    if (!d2client.weaponDB.has(weapon.referenceId) && !beingChecked.includes(weapon.referenceId)) {
                        beingChecked.push(weapon.referenceId);
                        i += 1;
                        await sleep(2*i);
                        d2client.apiRequest("getWeaponName", {hashIdentifier: weapon.referenceId}).then(u => {
                            const item = u.Response as weaponNameQuery;
                            const weapon = {Name: item.displayProperties.name, Type: item.itemTypeDisplayName} as weaponDatabaseObject;
                            d2client.weaponDB.set(item.hash.toString(), weapon);
                            console.log(`Added ${item.displayProperties.name} to database`);
                        })
                    }
                })
            })
        })
    })
}

// 	608898761 dungeon activityTypeHash
// 	2043403989 raid

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}