import {statRoles} from "../enums/statRoles";
import { entityQuery } from "../props/entityQuery";
import { ManifestActivity, ManifestQuery, RawManifestQuery } from "../props/manifest";
import { activityIdentifierObject } from "../props/activityIdentifierObject";
import { BungieGroupQuery, PendingClanmembersQuery } from "../props/bungieGroupQuery";
import { ActivityObject } from "../props/dbUser";
import { BungieProfile } from "../props/bungieProfile";
import { LinkedProfileResponse } from "../props/linkedProfileResponse";
import { URLSearchParams } from "url";
import { choosePlatformhtml } from "./htmlPages";
import { ActionRow, Button, ButtonStyle, Embed } from "discord-http-interactions";
import axios from "axios";

export function newRegistration(dcclient, d2client, dccode, d2code, res){
    d2client.discordTokens.discordOauthExchange(dccode).then(dcuser => {
        const data = new URLSearchParams();
        data.append("grant_type","authorization_code");
        data.append("code", d2code);
        data.append("client_id",d2client.clientID);
        data.append("client_secret",d2client.secret);
        d2client.token(data).then(x => {
            let id = x.membership_id;
            if(id){
                d2client.apiRequest("getBungieProfile",{id}).then(profile => {
                    const reply = profile.Response as BungieProfile;
                    let membershipType;
                    if(reply.steamDisplayName){membershipType = 3} else if(reply.xboxDisplayName){membershipType = 1} else if(reply.psnDisplayName){membershipType = 2} else if(reply.egsDisplayName){membershipType = 6} else {return;}
                    d2client.apiRequest("getBungieLinkedProfiles",{membershipType, membershipId: id}).then(resp => {
                        const reply2 = resp.Response as LinkedProfileResponse;
                        const primary = reply2.profiles.find(x => x.isCrossSavePrimary);
                        if(primary){
                            d2client.DB.set(dcuser.id,{
                                bungieId: id,
                                destinyId: primary.membershipId,
                                destinyName: reply.uniqueName,
                                membershipType: primary.membershipType,
                                tokens: {
                                    accessToken: x.access_token,
                                    accessExpiry: Date.now() + (x.expires_in*1000),
                                    refreshToken: x.refresh_token,
                                    refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                },
                                discordUser: dcuser
                            });
                            res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/api/panel");
                            dcclient.getMember(statRoles.guildID,dcuser.id).then(member => {
                                if(!member) return;
                                //@ts-ignore
                                if(member.roles.includes(statRoles.registeredID)) return;
                                //@ts-ignore
                                let roles = [...member.roles as string[], statRoles.registeredID];
                                //@ts-ignore
                                dcclient.setMember(statRoles.guildID,member.user.id,{roles}).catch(e => console.log(e));
                            });
                            updateStatRolesUser(dcclient,d2client,dcuser.id);
                            return;
                        } else {
                            if(reply2.profiles.length === 1){
                                d2client.DB.set(dcuser.id,{
                                    bungieId: id,
                                    destinyId: reply2.profiles[0].membershipId,
                                    destinyName: reply.uniqueName,
                                    membershipType: reply2.profiles[0].membershipType,
                                    tokens: {
                                        accessToken: x.access_token,
                                        accessExpiry: Date.now() + (x.expires_in*1000),
                                        refreshToken: x.refresh_token,
                                        refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                    },
                                    discordUser: dcuser
                                });
                                res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/api/panel");
                                dcclient.getMember(statRoles.guildID,dcuser.id).then(member => {
                                    if(!member) return;
                                    //@ts-ignore
                                    if(member.roles.includes(statRoles.registeredID)) return;
                                    //@ts-ignore
                                    let roles = [...member.roles as string[], statRoles.registeredID];
                                    //@ts-ignore
                                    dcclient.setMember(statRoles.guildID,member.user.id,{roles}).catch(e => console.log(e));
                                });
                                updateStatRolesUser(dcclient,d2client,dcuser.id);
                                return;
                            }
                            d2client.DB.set(dcuser.id,{
                                bungieId: id,
                                destinyName: reply.uniqueName,
                                tokens: {
                                    accessToken: x.access_token,
                                    accessExpiry: Date.now() + (x.expires_in*1000),
                                    refreshToken: x.refresh_token,
                                    refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                },
                                discordUser: dcuser
                            });
                            const endResult = choosePlatformhtml(reply2.profiles.sort(function (a,b) { return a.displayName.length - b.displayName.length}))
                            res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))})
                                .send(endResult);
                        }
                    }).catch(e => console.log(e));
                }).catch(e => console.log(e));
            } else {
                console.log("Registration failed, please generate a new code.");
            }
        }).catch(e => res.send(`Error fetching Bungie Tokens: ${e.message}`));
    }).catch(e => res.send(`Error fetching Discord Data: ${e.message}`));
}

export async function updateStatRoles(dcclient,d2client){
    const memberIds: string[] = Array.from(d2client.DB.keys());
    for (let i = 0; i < memberIds.length; i += 10) {
        await sleep(i);
        const ids: string[] = memberIds.slice(i, i + 10);
        const ignore = ["handledApplications"];
        ids.forEach(id => {
            if(ignore.includes(id)) return;
            updateStatRolesUser(dcclient,d2client,id);
        });
    }
}

export function updateStatRolesUser(dcclient,d2client,id){
    d2client.dbUserUpdater.updateStats(id).then(async (dbUser) => {
        if (!dbUser) {
            console.log(`NO DB USER FOR - ${id}`);
            return;
        }
        const discordAccessToken = await d2client.discordTokens.getToken(id)
            .catch(e => console.log(e));
        if(!discordAccessToken) return console.log(`${id} has no token, please ask them to re-register.`);
        let tempRaidObj = {};
        statRoles.raidNames.forEach(e => {
            tempRaidObj[e.toString()] = dbUser.raids[e.toString()]
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
        Object.keys(statRoles.kd).map(d => parseInt(d)).sort((a,b) => a-b ).forEach(key => {
            if(dbUser.stats.kd*10 >= key){
                tempArr[j] = statRoles.kd[key];
            }
        });
        j = tempArr.length;
        Object.keys(statRoles.lightLevel).map(d => parseInt(d)).sort((a,b) => a-b ).forEach(key => {
            if(dbUser.stats.light >= key){
                tempArr[j] = statRoles.lightLevel[key];
            }
        });
        j = tempArr.length;
        let clanMember = false;
        await d2client.apiRequest("getGroupMembers", {groupId: "3506545" /*Venerity groupID*/}).then(d => {
            const resp = d.Response as BungieGroupQuery;
            if (resp.results.map(x => x.bungieNetUserInfo.membershipId).includes(dbUser.bungieId)) {
                clanMember = true;
            }
        }).catch(e => console.log(4));
        dcclient.getMember(statRoles.guildID,id).then(async member => {
            let data: { nick?: string, roles: string[] } = {
                roles: []
            };
            const d2name = await d2client.getBungieTag(dbUser.bungieId);
            if(!dbUser.destinyName || dbUser.destinyName !== d2name) dbUser.destinyName = d2name;
            d2client.DB.set(id,dbUser);
            if(member.nick){
                if(!member.nick.endsWith(d2name)){
                    data.nick = d2name;
                }
            } else {
                data.nick = d2name;
            }
            const roles = member.roles.sort();
            data.roles = roles.filter(x => !statRoles.allIDs.includes(x));
            data.roles = [...data.roles, ...tempArr].sort();
            if(!(data.roles.length === roles.length && data.roles.every((role, i) => roles[i] === role))){
                dcclient.setMember(statRoles.guildID,id,data).catch(e => console.log(`Setting member ${id} failed.`));
            }
            axios.put(`https://discord.com/api/v10/users/@me/applications/${process.env.discordId}/role-connection`,
                {
                    platform_name: "Destiny 2",
                    platform_username: d2name,
                    metadata: {
                        clanmember: clanMember ? 1 : 0,
                        visitor: clanMember ? 0 : 1,
                        raids: dbUser.raids.Total,
                        dungeons: dbUser.dungeons.Total,
                        gms: dbUser.grandmasters.Total
                    }},{headers: {"Authorization": discordAccessToken, "Content-Type": "application/json"}}).catch(e => console.log(e));
        }).catch(e => {});//Member not on the server.
    });
}

export function fetchPendingClanRequests(dcclient, d2client) {
    d2client.refreshToken(d2client.adminuserID).then(d => {
        d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
            const resp = d.Response as PendingClanmembersQuery;
            const emojis = {1: "<:Xbox:1045358581316321280>", 2: "<:PlayStation:1057027325809672192>", 3: "<:Steam:1045354053087006800>", 6: "<:EpicGames:1048534129500770365>"};
            const handled = d2client.DB.get("handledApplications") ?? [];
            resp.results.forEach(async req => {
                if (!handled.includes(req.destinyUserInfo.membershipId)) {
                    const data = await d2client.dbUserUpdater.getPartialUserStats(
                        {
                            destinyId: req.destinyUserInfo.membershipId,
                            membershipType: req.destinyUserInfo.membershipType,
                        }
                        );
                    const embed = new Embed()
                        .setColor(0xae27ff)
                        .setTitle("A new clan request")
                        .setFields([
                            {"name": "User", "value": `${req.bungieNetUserInfo.supplementalDisplayName}`, "inline": true},
                            {"name": "Platforms", "value": `${req.destinyUserInfo.applicableMembershipTypes.map(y => emojis[y]).join(" ")}`, "inline": true},
                            {"name": "Power Level", "value": `${data.stats?.light ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Raid", "value": `${data.raids?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Dungeon", "value": `${data.dungeons?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Grandmaster", "value": `${data.grandmasters?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "PvP K/D", "value": `${Math.round((data.stats?.kd ?? 0) * 100)/100}`}
                        ])
                    const actionRows: ActionRow[] = [];
                    actionRows.push(
                        new ActionRow().setComponents([
                            new Button()
                                .setLabel("Approve")
                                .setStyle(ButtonStyle.Success)
                                .setCustomId(`clanrequest-approve-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`),
                            new Button()
                                .setLabel("Deny")
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId(`clanrequest-deny-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`)
                        ])
                    );
                    dcclient.newMessage("1048344159326572605",{
                        embeds: [embed],
                        components: actionRows
                    }).then(() => {
                        handled.push(req.destinyUserInfo.membershipId);
                        d2client.DB.set("handledApplications", handled);
                    });
                }
            })
        }).catch(e => console.log(e));
    });
}

export function sortActivities(activities: ActivityObject): Map<string, string[]> {
    const keys = Object.keys(activities);
    const sorted = Object.keys(activities).sort((a,b) => activities[b]-activities[a]).filter(a => !a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Heroic"))
    const size = sorted.filter(a => activities[a] !== 0 && (!a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Prestige"))).length;
    const ans: Map<string, string[]> = new Map();
    let i = 0
    while (i !== size) {
        if (ans[sorted[i]] == undefined) ans[sorted[i]] = [];
        ans[sorted[i]].push(activities[sorted[i]] as unknown as string)
        if (keys.includes(`${sorted[i]}, Master`)) {
            ans[sorted[i]].push(`Master`, activities[`${sorted[i]}, Master`]);
        }
        else if (keys.includes(`${sorted[i]}, Heroic`)) {
            ans[sorted[i]].push(`Heroic`, activities[`${sorted[i]}, Heroic`]);
        }
        else if (keys.includes(`${sorted[i]}, Prestige`)) {
            ans[sorted[i]].push(`Prestige`, activities[`${sorted[i]}, Prestige`]);
        }
        i += 1;
    }
    return ans;
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
        const PrestigeTest = new RegExp(/Prestige/g);
        const HeroicTest = new RegExp(/Heroic/g);
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
                else if (HeroicTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Heroic";
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

const crypt = (salt, text) => {
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const byteHex = (n) => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
    if(!salt || !text) return false;
    return text
        .split("")
        .map(textToChars)
        .map(applySaltToChar)
        .map(byteHex)
        .join("");
};

const decrypt = (salt, encoded) => {
    if(!salt || !encoded) return false;
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
    return encoded
        .match(/.{1,2}/g)
        .map((hex) => parseInt(hex, 16))
        .map(applySaltToChar)
        .map((charCode) => String.fromCharCode(charCode))
        .join("");
};

export {crypt, decrypt};