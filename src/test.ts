import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import {CharacterQuery} from "./props/characterQuery";
import {weaponDatabaseObject, WeaponQuery} from "./props/weaponQuery";
import {weaponNameQuery} from "./props/weaponNameQuery";
import {ManifestActivity, ManifestActivityQuery, ManifestQuery} from "./props/manifest";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import { PendingClanmembersQuery } from "./props/bungieGroupQuery";
import { fetchPendingClanRequests } from "./handlers/utils";

const d2client = new requestHandler();
const dcclient = new discordHandler();

function instantiateWeaponDatabase() {
    const destinyMembershipId = "4611686018468779813";
    const beingChecked: number[] = []
    d2client.apiRequest("getDestinyCharacters", {destinyMembershipId, membershipType: 3}).then(d => {
        const resp = d.Response as CharacterQuery;
        resp.characters.forEach(e => {
            const characterId = e.characterId;
            d2client.apiRequest("getWeaponStats",{membershipType: 3, destinyMembershipId, characterId}).then(v => {
                const resp2 = v.Response as WeaponQuery;
                let i = 0;
                resp2.weapons.forEach(async weapon => {
                    if (/*!d2client.weaponDB.has(weapon.referenceId) &&*/ !beingChecked.includes(weapon.referenceId)) {
                        beingChecked.push(weapon.referenceId);
                        i += 1;
                        await sleep(2*i);
                        d2client.apiRequest("getWeaponName", {hashIdentifier: weapon.referenceId}).then(u => {
                            const item = u.Response as weaponNameQuery;
                            const weapon = {
                                Name: item.displayProperties.name,
                                Type: item.itemTypeDisplayName,
                                Slot: item.equippingBlock.equipmentSlotTypeHash,
                                UniqueLabel: item.equippingBlock.uniqueLabel
                            } as weaponDatabaseObject;
                            console.log(JSON.stringify(weapon));
                            d2client.weaponDB.set(item.hash.toString(), weapon);
                            console.log(`Added ${item.displayProperties.name} to database`);
                        }).catch(e => console.log(`3 ${e}`));
                    }
                })
            }).catch(e => console.log(`2 ${e}`));
        })
    }).catch(e => console.log(`1 ${e}`));
}

function instantiateActivityDatabase() {
    const iterator = activityIdentifiers.keys()
    let result = iterator.next();
    while (!result.done) {
        const key = result.value;
        const values = activityIdentifiers.get(result.value.toString());
        const saved = d2client.activityIdentifierDB.get(key) as activityIdentifierObject ?? {IDs: []};
        values?.forEach(e => {
            if (!saved.IDs.includes(e)) {
                saved.IDs.push(e);
            }
        });
        d2client.activityIdentifierDB.set(key, saved);
        result = iterator.next();
    }
    console.log("Activity DB done.");
}

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}

//d2client.localRegister("50353a5255d8508f9cbecbf25e86f606", "190157848246878208");
/*d2client.refreshToken("190157848246878208").then(d => {
    d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
        const resp = d.Response as PendingClanmembersQuery;
        console.log(resp.results[0]);
    }).catch(e => console.log(e));
});*/

fetchPendingClanRequests(dcclient, d2client);
//instantiateActivityDatabase();
//instantiateWeaponDatabase();