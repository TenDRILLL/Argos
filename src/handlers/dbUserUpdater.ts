import {DBUser, partialDBUser, Stats} from "../props/dbUser";
import {CharacterQuery} from "../props/characterQuery";
import {ActivityQuery} from "../props/activity";

export class DBUserUpdater {
    private d2client;

    constructor(d2client){
        this.d2client = d2client;
    }

    async updateStats(userid: string): Promise<DBUser>{
        return new Promise((res, rej) => {
            if(!this.d2client.DB.has(userid)) rej(`UpdateStats: No user with the ID ${userid} found.`);
            let dbUser = this.d2client.DB.get(userid);
            this.d2client.apiRequest("getDestinyCharacters",{destinyMembershipId: dbUser.destinyId, membershipType: dbUser.membershipType}).then(d => {
                const resp = d.Response as CharacterQuery;
                const stats: Stats = {
                    kd: resp.mergedAllCharacters.results.allPvP.allTime.killsDeathsRatio.basic.value,
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
                                const type = data["type"]; // 0 raids, 1 GMS, 2 dungeons
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
                    this.d2client.DB.set(userid, dbUser);
                    res(dbUser);
                }).catch(e => console.log(2));
            }).catch(e => console.log(3));
        });
    }

    async getPartialUserStats(partialUser: {destinyId: string, membershipType: number}): Promise<partialDBUser> {
        return new Promise((res, rej) => {
            this.d2client.apiRequest("getDestinyCharacters",{destinyMembershipId: partialUser.destinyId, membershipType: partialUser.membershipType}).then(d => {
                const resp = d.Response as CharacterQuery;
                const stats: Stats = {
                    kd: resp.mergedAllCharacters.results.allPvP.allTime.killsDeathsRatio.basic.value,
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
                                const type = data["type"]; // 0 raids, 1 GMS, 2 dungeons
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
}