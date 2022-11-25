import {DBUser, Stats, RaidObject} from "../props/dbUser";
import {CharacterQuery} from "../props/characterQuery";
import {ActivityQuery} from "../props/activity";
import {activityIdentifiers} from "../enums/activityIdentifiers";

export class DBUserUpdater {
    private DB;
    private d2client;

    constructor(DB,d2client){
        this.DB = DB;
        this.d2client = d2client;
    }

    async updateStats(userid: string): Promise<DBUser>{
        return new Promise(res => {
            let dbUser = this.DB.get(userid);
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
                            let raidObject = {};
                            resp.activities.forEach(a => {
                                for(let [k,v] of activityIdentifiers.entries()){
                                    if(v.includes(a.activityHash)){
                                        if(raidObject[k.toString()]){
                                            raidObject[k.toString()] += a.values.activityCompletions.basic.value;
                                        } else {
                                            raidObject[k.toString()] = a.values.activityCompletions.basic.value;
                                        }
                                    }
                                }
                            });
                            res(raidObject);
                        });
                    }));
                });
                Promise.all(promises).then(data => {
                    const obj: RaidObject = {
                        "Crown of Sorrow": 0,
                        "Deep Stone Crypt": 0,
                        "Garden of Salvation": 0,
                        "King's Fall, Legend": 0,
                        "King's Fall, Master": 0,
                        "Last Wish": 0,
                        "Leviathan, Eater of Worlds, Normal": 0,
                        "Leviathan, Eater of Worlds, Prestige": 0,
                        "Leviathan, Spire of Stars, Normal": 0,
                        "Leviathan, Spire of Stars, Prestige": 0,
                        "Leviathan, Normal": 0,
                        "Leviathan, Prestige": 0,
                        "Scourge of the Past": 0,
                        "Vault of Glass, Master": 0,
                        "Vault of Glass, Normal": 0,
                        "Vow of the Disciple, Master": 0,
                        "Vow of the Disciple, Normal": 0,
                        "Total": 0
                    };
                    data.forEach(char => {
                        Object.keys(char).forEach(key => {
                            if(obj[key]){
                                obj[key] += char[key];
                                obj["Total"] += char[key];
                            } else {
                                obj[key] = char[key];
                                obj["Total"] += char[key];
                            }
                        });
                    });
                    dbUser.stats = stats;
                    dbUser.raids = obj;
                    this.DB.set(userid, dbUser);
                    res(dbUser);
                }).catch(e => console.log(e));
            });
        });
    }
}