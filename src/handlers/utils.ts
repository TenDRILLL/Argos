import {verifyKey} from "discord-interactions";
import {statRoles} from "../enums/statRoles";
import "dotenv/config";
import { weaponNameQuery } from "../props/weaponNameQuery";
import { weaponDatabaseObject } from "../props/weaponQuery";

export function VerifyDiscordRequest() {
    return function (req, res, buf, encoding) {
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");
        const isValidRequest = verifyKey(buf, signature, timestamp, process.env.discordKey as string);
        if (!isValidRequest) {
            res.status(401).send("Bad request signature");
        }
    };
}

export async function updateStatRoles(DB,dcclient,d2client){
    const memberIds: String[] = Array.from(DB.keys());
    for (let i = 0; i < memberIds.length; i += 10) {
        await sleep(i);
        const ids: String[] = memberIds.slice(i, i + 10);
        ids.forEach(id => {
            d2client.dbUserUpdater.updateStats(id).then(dbUser => {
                let tempRaidObj = {
                    kingsFall: dbUser.raids["King's Fall, Legend"] + dbUser.raids["King's Fall, Master"],
                    vow: dbUser.raids["Vow of the Disciple, Normal"] + dbUser.raids["Vow of the Disciple, Master"],
                    vault: dbUser.raids["Vault of Glass, Normal"] + dbUser.raids["Vault of Glass, Master"],
                    crypt: dbUser.raids["Deep Stone Crypt"],
                    garden: dbUser.raids["Garden of Salvation"],
                    lastWish: dbUser.raids["Last Wish"]
                };
                let tempArr: String[] = [];
                let j;
                Object.keys(statRoles.raids).forEach((key) => { //kingsFall
                    j = tempArr.length;
                    Object.keys(statRoles.raids[key]).forEach(key2 => { //1
                        if(tempRaidObj[key] >= key2){
                            tempArr[j] = statRoles.raids[key][key2];
                        }
                    });
                });
                j = tempArr.length;
                Object.keys(statRoles.kd).forEach(key => {
                    if(dbUser.stats.kd*10 >= parseInt(key)){
                        tempArr[j] = statRoles.kd[key];
                    }
                });
                j = tempArr.length;
                Object.keys(statRoles.lightLevel).forEach(key => {
                    if(dbUser.stats.light >= key){
                        tempArr[j] = statRoles.lightLevel[key];
                    }
                });
                dcclient.getMember(statRoles.guildID,id).then(async member => {
                    let data = {};
                    const d2name = await d2client.getBungieTag(dbUser.bungieId);
                    if(member.nick){
                        if(!member.nick.endsWith(d2name)){
                            data["nick"] = d2name;
                        }
                    } else {
                        data["nick"] = d2name;
                    }
                    let roles = member.roles;
                    roles = roles.filter(x => !statRoles.allIDs.includes(x));
                    data["roles"] = [...roles, ...tempArr];
                    if(dbUser.roles !== undefined && dbUser.roles === roles) return;
                    dbUser.roles = roles;
                    dcclient.setMember(statRoles.guildID,id,data);
                    DB.set(id,dbUser);
                });
            });
        });
    }
}

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}

export function getWeaponInfo(weaponDB,d2client,weaponID): Promise<weaponDatabaseObject> {
    return new Promise<weaponDatabaseObject>(res => {
        if ((!weaponDB.has(weaponID))) {
            res(weaponDB.get(weaponID));
        } else {
            d2client.apiRequest("getWeaponName", {hashIdentifier: weaponID}).then(u => {
                const item = u.Response as weaponNameQuery;
                weaponDB.set(item.hash.toString(), {Name: item.displayProperties.name, Type: item.itemTypeDisplayName});
                res({Name: item.displayProperties.name, Type: item.itemTypeDisplayName} as weaponDatabaseObject);
            });
        }
    });
}

export function normalizeRaidName(raidName) {
    const parts: string[] = raidName.split(":");
    const preOrMas = parts[parts.length-1] == " Master" || parts[parts.length-1] == " Prestige";
    return parts.length === 1  || !(preOrMas) ? parts[0] : parts.join(",");
}