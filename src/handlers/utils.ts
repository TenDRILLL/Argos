import {verifyKey} from "discord-interactions";
import {statRoles} from "../enums/statRoles";
import "dotenv/config";
import { entityQuery } from "../props/entityQuery";
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
    const memberIds: string[] = Array.from(d2client.DB.keys());
    for (let i = 0; i < memberIds.length; i += 10) {
        await sleep(i);
        const ids: string[] = memberIds.slice(i, i + 10);
        const ignore = ["handledApplications"];
        ids.forEach(id => {
            if(ignore.includes(id)) return;
            d2client.dbUserUpdater.updateStats(id).then(async () => {
                let dbUser = d2client.DB.get(id);
                let tempRaidObj = {};
                statRoles.raidNames.forEach(e => {
                    tempRaidObj[e.toString()] = dbUser.raid[e.toString()]
                })
                let tempArr: string[] = [];
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

export function fetchPendingClanRequests(dcclient, d2client) {
    d2client.refreshToken(d2client.adminuserID).then(d => {
        d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
            const resp = d.Response as PendingClanmembersQuery;
            const emojis = {1: "<:Xbox:1045358581316321280>", 2: "<:PlayStation:1045354080794595339>", 3: "<:Steam:1045354053087006800>", 6: "<:EpicGames:1048534129500770365>"};
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
                            {"name": "Power Level", "value": `${data.stats?.light ?? "UNKNOWN"}`, "inline": true},
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
                                        type: 2, label: "Approve", style: 3, custom_id: `clanrequest-approve-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`
                                    }, {
                                        type: 2, label: "Deny", style: 4, custom_id: `clanrequest-deny-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`
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

export function getWeaponInfo(d2client,weaponID): Promise<entityQuery> {
    return new Promise<entityQuery>(res => {
        if ((d2client.entityDB.has(weaponID))) {
            res(d2client.entityDB.get(weaponID));            
        } else {
            d2client.apiRequest("getEntity", {hashIdentifier: weaponID}).then(u => {
                const item = u.Response as entityQuery;
                d2client.entityDB.set(item.hash.toString(), item);
                res(item);
            }).catch(e => console.log(e));
        }
    });
}

export function normalizeActivityName(raidName) {
    const parts: string[] = raidName.split(":");
    return parts[0];
}

export function updateActivityIdentifierDB(d2client) {
    d2client.apiRequest("getManifests",{}).then(d => {
        const resp = d.Response as ManifestQuery;
        const enManifest = resp.jsonWorldComponentContentPaths.en["DestinyActivityDefinition"];
        const MasterTest = new RegExp(/Master/g);
        const PrestigeTest = new RegExp(/Prestige/g)
        d2client.rawRequest(`https://www.bungie.net${enManifest}`).then(e => {
            Object.values(e as unknown as RawManifestQuery).forEach(x => {
                const activity = x as ManifestActivity;      
                const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.name) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                if (MasterTest.test(activity.displayProperties.name)) { //Check if name contains Master
                    saved.difficultName = "Master";
                    saved.difficultIDs.push(activity.hash);
                    }
                else if (PrestigeTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Prestige";
                    saved.difficultIDs.push(activity.hash);
                }
                if (608898761/*dungeon*/ === activity.activityTypeHash) {
                    saved.type = 1;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved);
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            d2client.entityDB.set("activityOrder", temp);
                        }
                }
                } else if (2043403989/*raid*/ === activity.activityTypeHash) {
                    saved.type = 0;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved); 
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                } else if (new RegExp(/Grandmaster/gi).test(activity.displayProperties.name) && activity.displayProperties.description != "Grandmaster") {
                    const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.description) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                    saved.type = 2;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(activity.displayProperties.description, saved);
                        if (!d2client.entityDB.get("activityOrder").includes(activity.originalDisplayProperties.description)) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(activity.originalDisplayProperties.description);
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                }
            })
        });    
    }).catch(e => console.log(e));
}