import {DBUser, partialDBUser, Stats} from "../props/dbUser";
import {CharacterQuery} from "../props/characterQuery";
import {ActivityQuery} from "../props/activity";
import axios from "axios";
import { statRoles } from "../enums/statRoles";
import { BungieGroupQuery } from "../props/bungieGroupQuery";
import {DestinyProfileQuery} from "../props/destinyProfileQuery";

export class DBUserUpdater {
    private d2client;

    constructor(d2client){
        this.d2client = d2client;
    }

    async updateStats(userid: string): Promise<DBUser>{
        return new Promise((res, rej) => {
            if(!this.d2client.DB.has(userid)) rej(`UpdateStats: No user with the ID ${userid} found.`);
            let dbUser = this.d2client.DB.get(userid);
            this.d2client.apiRequest("getDestinyProfile",{membershipType: dbUser.membershipType, destinyMembershipId: dbUser.destinyId}).then(d => {
                const profresp = d.Reponse as DestinyProfileQuery;
                this.d2client.apiRequest("getDestinyCharacters",{destinyMembershipId: dbUser.destinyId, membershipType: dbUser.membershipType}).then(d => {
                    const resp = d.Response as CharacterQuery;
                    const stats: Stats = {
                        kd: resp.mergedAllCharacters.results.allPvP?.allTime?.killsDeathsRatio?.basic.value ?? 0,
                        light: resp.mergedAllCharacters.merged.allTime.highestLightLevel.basic.value
                    };
                    const promises: Promise<Object>[] = [];
                    resp.characters.forEach(character => {
                        promises.push(new Promise((res)=>{
                            this.d2client.apiRequest("getActivityStats",{destinyMembershipId: dbUser.destinyId, membershipType: dbUser.membershipType, characterId: character.characterId}).then(d => {
                                const resp = d.Response as ActivityQuery;
                                let activityIds = {0: {"Total": 0}, 1: {"Total": 0}, 2: {"Total": 0}};
                                for (let [key, data] of this.d2client.activityIdentifierDB) {
                                    const IDs = data["IDs"];
                                    const type = data["type"]; // 0 raids, 1 dungeons, 2 GMS
                                    const difficultName = data["difficultName"];
                                    const difficultIDs = data["difficultIDs"];
                                    activityIds[type][key] = 0;
                                    resp.activities.forEach(a => {
                                        if(IDs.includes(a.activityHash)){
                                            activityIds[type][key] += a.values.activityCompletions.basic.value;
                                            activityIds[type]["Total"] += a.values.activityCompletions.basic.value;
                                        }
                                        if(difficultIDs.includes(a.activityHash)){
                                            if (activityIds[type][`${key}, ${difficultName}`]) {
                                                activityIds[type][`${key}, ${difficultName}`] += a.values.activityCompletions.basic.value;
                                            } else {
                                                activityIds[type][`${key}, ${difficultName}`] = a.values.activityCompletions.basic.value;
                                            }
                                        }
                                    });
                                    res(activityIds);
                                }
                            }).catch(e => console.log(1));
                        }));
                    });
                    Promise.all(promises).then(async data => {
                        let TotalClears = {0: {"Total": 0}, 1: {"Total": 0}, 2: {"Total": 0}};
                        data.forEach(char => {
                            Object.keys(char).forEach(type => {
                                Object.keys(char[type]).forEach(key => {
                                    if (TotalClears[type][key]) {
                                        TotalClears[type][key] += char[type][key]
                                    } else {
                                        TotalClears[type][key] = char[type][key]
                                    }
                                })
                            });
                        });
                        dbUser.stats = stats;
                        dbUser.raids = TotalClears[0];
                        dbUser.dungeons = TotalClears[1];
                        dbUser.grandmasters = TotalClears[2];
                        dbUser.destinyName = await this.d2client.getBungieTag(dbUser.bungieId);
                        dbUser.guardianRank = profresp.profile.data.currentGuardianRank ?? 1;
                        this.d2client.DB.set(userid, dbUser);
                        res(dbUser);
                    }).catch(e => console.log(2));
                }).catch(e => console.log(5));
            }).catch(e => console.log(0));
        });
    }

    async getPartialUserStats(partialUser: {destinyId: string, membershipType: number}): Promise<partialDBUser> {
        return new Promise((res, rej) => {
            this.d2client.apiRequest("getDestinyCharacters",{destinyMembershipId: partialUser.destinyId, membershipType: partialUser.membershipType}).then(d => {
                const resp = d.Response as CharacterQuery;
                const stats: Stats = {
                    kd: resp.mergedAllCharacters.results.allPvP?.allTime?.killsDeathsRatio?.basic.value ?? 0,
                    light: resp.mergedAllCharacters.merged.allTime.highestLightLevel.basic.value
                };
                const promises: Promise<Object>[] = [];
                resp.characters.forEach(character => {
                    promises.push(new Promise((res)=>{
                        this.d2client.apiRequest("getActivityStats",{destinyMembershipId: partialUser.destinyId, membershipType: partialUser.membershipType, characterId: character.characterId}).then(d => {
                            const resp = d.Response as ActivityQuery;
                            let activityIds = {0: {"Total": 0}, 1: {"Total": 0}, 2: {"Total": 0}};
                            for (let [key, data] of this.d2client.activityIdentifierDB) {
                                const IDs = data["IDs"];
                                const type = data["type"]; // 0 raids, 1 dungeons, 2 GMs
                                const difficultName = data["difficultName"];
                                const difficultIDs = data["difficultIDs"];
                                activityIds[type][key] = 0;
                                resp.activities.forEach(a => {                                    
                                    if(IDs.includes(a.activityHash)){
                                        activityIds[type][key] += a.values.activityCompletions.basic.value;
                                        activityIds[type]["Total"] += a.values.activityCompletions.basic.value;
                                    }
                                    if(difficultIDs.includes(a.activityHash)){
                                        if (activityIds[type][`${key}, ${difficultName}`]) {
                                            activityIds[type][`${key}, ${difficultName}`] += a.values.activityCompletions.basic.value;
                                        } else {
                                            activityIds[type][`${key}, ${difficultName}`] = a.values.activityCompletions.basic.value;
                                        }
                                    }
                                });
                            res(activityIds);
                            }
                        }).catch(e => console.log(1));
                    }));
                });
                Promise.all(promises).then(data => {                    
                    let TotalClears = {0: {"Total": 0}, 1: {"Total": 0}, 2: {"Total": 0}};
                    data.forEach(char => {
                        Object.keys(char).forEach(type => {
                            Object.keys(char[type]).forEach(key => {
                                if (TotalClears[type][key]) {
                                    TotalClears[type][key] += char[type][key]
                                } else {
                                    TotalClears[type][key] = char[type][key]
                                }
                            })
                        });
                    });
                    res({
                        destinyId: partialUser.destinyId,
                        membershipType: partialUser.membershipType,
                        stats: stats,
                        raids: TotalClears[0],
                        dungeons: TotalClears[1],
                        grandmasters: TotalClears[2],
                    });
                }).catch(e => console.log(2));
            }).catch(e => console.log(3));
        });
    }

    async updateAllUserRoles(dcclient,d2client){
        const memberIds: string[] = Array.from(d2client.DB.keys());
        for (let i = 0; i < memberIds.length; i += 10) {
            await this.sleep(i);
            const ids: string[] = memberIds.slice(i, i + 10);
            ids.forEach(id => {
                this.updateUserRoles(dcclient,d2client,id);
            });
        }
    }
    
    updateUserRoles(dcclient,d2client,id){
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
            dcclient.getMember(statRoles.guildID,id).then(async member => {
                let data: { nick?: string, roles: string[] } = {
                    roles: []
                };
                const d2name = await d2client.getBungieTag(dbUser.bungieId);
                if(!dbUser.destinyName || dbUser.destinyName !== d2name) dbUser.destinyName = d2name;
                d2client.DB.set(id,dbUser);
                const roles = member.roles.sort();
                data.roles = roles.filter(x => !statRoles.allIDs.includes(x));
                data.roles = [...data.roles, ...tempArr].sort();
                data.roles.push(dbUser.inClan);
                if(!(data.roles.length === roles.length && data.roles.every((role, i) => roles[i] === role))){
                    dcclient.setMember(statRoles.guildID,id,data).catch(e => console.log(`Setting member ${id} failed.`));
                }
                axios.put(`https://discord.com/api/v10/users/@me/applications/${process.env.discordId}/role-connection`,
                    {
                        platform_name: "Destiny 2",
                        platform_username: d2name,
                        metadata: {
                            raids: dbUser.raids.Total,
                            dungeons: dbUser.dungeons.Total,
                            gms: dbUser.grandmasters.Total,
                            gr: dbUser.guardianRank
                        }},{headers: {"Authorization": discordAccessToken, "Content-Type": "application/json"}}).catch(e => console.log(e));
            }).catch(e => {});//Member not on the server.
        });
    }
    
    sleep(seconds){
        return new Promise(res => {
            setTimeout(()=>{
                res("");
            },seconds*1000);
        });
    }

    async updateClanMembers(d2client){
        let clanMembers = await d2client.apiRequest("getGroupMembers", {groupId: "3506545" /*Venerity groupID*/})
            .catch(e => console.log(14));
        const resp = clanMembers.Response as BungieGroupQuery ?? {results: []};
        const ids = resp.results.map(x => x.bungieNetUserInfo.membershipId);
        if(ids.length > 0){
            for (let [key, data] of d2client.DB){
                data.inClan = ids.includes(data.bungieId) ? statRoles.clanMember : statRoles.justVisiting;
                d2client.DB.set(key, data);
            }
        }
    }
}