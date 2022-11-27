import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import {CharacterQuery} from "./props/characterQuery";
import enmap from "enmap";
import {weaponDatabaseObject, WeaponQuery, WeaponStat} from "./props/weaponQuery";
import { weaponNameQuery } from "./props/weaponNameQuery";
import {statRoles} from "./enums/statRoles";
import { getWeaponInfo } from "./handlers/utils";

const DB = new enmap({name:"users"});
const weaponDB = new enmap({name: "weapons"})
const d2client = new requestHandler(process.env.apikey, DB);
const dcclient = new discordHandler();

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
                    if (!weaponDB.has(weapon.referenceId) && !beingChecked.includes(weapon.referenceId)) {
                        beingChecked.push(weapon.referenceId);
                        i += 1;
                        await sleep(2*i);
                        d2client.apiRequest("getWeaponName", {hashIdentifier: weapon.referenceId}).then(u => {
                            const item = u.Response as weaponNameQuery;
                            const weapon = {Name: item.displayProperties.name, Type: item.itemTypeDisplayName} as weaponDatabaseObject;
                            weaponDB.set(item.hash.toString(), weapon);
                            console.log(`Added ${item.displayProperties.name} to database`);
                        })
                    }
                })
            })
        })
    })
}

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}