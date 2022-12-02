import {verifyKey} from "discord-interactions";
import {statRoles} from "../enums/statRoles";
import "dotenv/config";
import { weaponNameQuery } from "../props/weaponNameQuery";
import { weaponDatabaseObject } from "../props/weaponQuery";
import { ManifestActivity, ManifestQuery, RawManifestQuery } from "../props/manifest";
import { activityIdentifierObject } from "../props/activityIdentifierObject";
import { BungieGroupQuery, PendingClanmembersQuery } from "../props/bungieGroupQuery";

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

export async function updateStatRoles(dcclient,d2client){
    const memberIds: String[] = Array.from(d2client.DB.keys());
    for (let i = 0; i < memberIds.length; i += 10) {
        await sleep(i);
        const ids: String[] = memberIds.slice(i, i + 10);
        ids.forEach(id => {
            d2client.dbUserUpdater.updateStats(id).then(async dbUser => {
                let tempRaidObj = {
                    kingsFall: dbUser.raids["King's Fall"] + dbUser.raids["King's Fall, Master"],
                    vow: dbUser.raids["Vow of the Disciple"] + dbUser.raids["Vow of the Disciple, Master"],
                    vault: dbUser.raids["Vault of Glass"] + dbUser.raids["Vault of Glass, Master"],
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
                j = tempArr.length;
                await d2client.apiRequest("getGroupMembers", {groupId: "3506545" /*Venerity groupID*/}).then(d => {
                    const resp = d.Response as BungieGroupQuery;
                    if (resp.results.map(x => x.bungieNetUserInfo.membershipId).includes(dbUser.bungieId)) {
                        tempArr[j] = statRoles.guildMember;
                    } else {
                        tempArr[j] = statRoles.justVisiting;
                    }
                }).catch(e => console.log(4));
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
                    d2client.DB.set(id,dbUser);
                    dcclient.setMember(statRoles.guildID,id,data).catch(e => console.log(`Setting member ${id} failed.`));
                });
            });
        });
    }
}

export function fetchPendingClanRequests(dcclient, d2client, adminUserID) {
    d2client.refreshToken(adminUserID).then(d => {
        d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
            const resp = d.Response as PendingClanmembersQuery;
            d2client.DB.set("handledApplications", []);
            const emojis = {1: "<:Xbox:1045358581316321280>", 2: "<:PlayStation:1045354080794595339>", 3: "<:Steam:1045354053087006800>"};
            const handled = d2client.DB.get("handledApplications") ?? [];
            resp.results.forEach(async req => {
                if (!handled.includes(req.destinyUserInfo.membershipId)) {
                    const data = JSON.parse(await d2client.dbUserUpdater.updateStats("",
                        {
                            destinyId: req.destinyUserInfo.membershipId,
                            membershipType: req.destinyUserInfo.membershipType
                        }));

                    const embed = {
                        "type": "rich",
                        "title": "A new clan request",
                        "color": 0xae27ff,
                        "fields": [
                            {"name": "User", "value": `${req.bungieNetUserInfo.supplementalDisplayName}`, "inline": true},
                            {"name": "Platforms", "value": `${req.destinyUserInfo.applicableMembershipTypes.map(y => emojis[y]).join(" ")}`, "inline": true},
                            {"name": "Power Level", "value": `${data.stats?.power ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Raid", "value": `${data.raids?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Dungeon", "value": `${data.dungeons?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Grandmaster", "value": `${data.grandmasters?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "PvP K/D", "value": `${Math.round((data.stats?.kd ?? 0) * 100)/100}`}
                        ]
                    };

                    dcclient.sendMessage("1048344159326572605", {
                        embeds: [embed],
                        components: [
                            {
                                type: 1, components: [
                                    {
                                        type: 2, label: "Approve", style: 3, custom_id: `clanrequest-approve-${req.bungieNetUserInfo.membershipId}`
                                    }, {
                                        type: 2, label: "Deny", style: 4, custom_id: `clanrequest-deny-${req.bungieNetUserInfo.membershipId}`
                                    }
                                ]
                            }
                        ]
                    }).then(() => {
                        handled.push(req.destinyUserInfo.membershipId);
                        d2client.DB.set("handledApplications", handled);
                    });
                }
            })
        }).catch(e => console.log(e));
    });
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
            }).catch(e => console.log(e));
        }
    });
}

export function normalizeActivityName(raidName) {
    const parts: string[] = raidName.split(":");
    const preOrMas = parts[parts.length-1] === " Master" || parts[parts.length-1] === " Prestige";
    return parts.length === 1 || !(preOrMas) ? parts[0] : parts.join(",");
}

export function updateActivityIdentifierDB(d2client) {
    d2client.apiRequest("getManifests",{}).then(d => {
        const resp = d.Response as ManifestQuery;
        const enManifest = resp.jsonWorldComponentContentPaths.en["DestinyActivityDefinition"];
        d2client.rawRequest(`https://www.bungie.net${enManifest}`).then(e => {
            Object.values(e as unknown as RawManifestQuery).forEach(x => {
                const activity = x as ManifestActivity;
                if ([608898761/*dungeon*/, 2043403989/*raid*/].includes(activity.activityTypeHash)) {
                    const saved = d2client.activityIdentifierDB.get(normalizeActivityName(activity.displayProperties.name)) as activityIdentifierObject ?? {IDs: []};
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved)
                }
            }   else if (new RegExp(/Grandmaster/gi).test(activity.displayProperties.name)) {
                    const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.description) as activityIdentifierObject ?? {IDs: []};
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.originalDisplayProperties.description), saved)
                    }
                }
            })
        });    
    }).catch(e => console.log(e));
}