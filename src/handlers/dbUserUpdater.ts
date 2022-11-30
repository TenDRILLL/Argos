import {DBUser, Stats, RaidObject, DungeonsObject, GrandmastersObject} from "../props/dbUser";
import {CharacterQuery} from "../props/characterQuery";
import {ActivityQuery} from "../props/activity";
import {activityIdentifiers} from "../enums/activityIdentifiers";
import {normalizeActivityName} from "./utils";

export class DBUserUpdater {
    private d2client;

    constructor(d2client){
        this.d2client = d2client;
    }

    async updateStats(userid: string): Promise<DBUser>{
        return new Promise(res => {
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
                    const raids: RaidObject = {
                        "Crown of Sorrow": 0,
                        "Deep Stone Crypt": 0,
                        "Garden of Salvation": 0,
                        "King's Fall": 0,
                        "King's Fall, Master": 0,
                        "Last Wish": 0,
                        "Leviathan, Eater of Worlds": 0,
                        "Leviathan, Eater of Worlds, Prestige": 0,
                        "Leviathan, Spire of Stars": 0,
                        "Leviathan, Spire of Stars, Prestige": 0,
                        "Leviathan": 0,
                        "Leviathan, Prestige": 0,
                        "Scourge of the Past": 0,
                        "Vault of Glass, Master": 0,
                        "Vault of Glass": 0,
                        "Vow of the Disciple, Master": 0,
                        "Vow of the Disciple": 0,
                        "Total": 0
                    };
                    const dungeons: DungeonsObject = {
                        "Duality": 0,
                        "Grasp of Avarice": 0,
                        "Prophecy": 0,
                        "Pit of Heresy": 0,
                        "Shattered Throne": 0,
                        "Presage": 0,
                        "Harbinger": 0,
                        "Zero Hour": 0,
                        "The Whisper": 0,
                        "Total": 0
                    };
                    const gms: GrandmastersObject = {
                        "The Glassway": 0,
                        "The Lightblade": 0,
                        "Fallen S.A.B.E.R": 0,
                        "The Disgraced": 0,
                        "Exodus Crash": 0,
                        "The Devils Lair": 0,
                        "Proving Grounds": 0,
                        "Warden of Nothing": 0,
                        "The Insight Terminus": 0,
                        "The Corrupted": 0,
                        "The Arms Dealer": 0,
                        "The Inverted Spire": 0,
                        "Birthplace of the Vile": 0,
                        "Lake of Shadows": 0,
                        "The Scarlet Keep": 0,

                        "Broodhold": 0,
                        "The Festering Core": 0,
                        "The Hollowed Lair": 0,
                        "Savathun's Song": 0,
                        "Tree of Probabilities": 0,
                        "Strange Terrain": 0,
                        "A Garden World": 0,
                        "Total": 0
                    }
                    data.forEach(char => {
                        Object.keys(char).forEach(key => {
                            key = normalizeActivityName(key); //Last Wish
                            if(raids[key] != undefined){
                                raids[key] += char[key];
                                raids["Total"] += char[key];
                            } else if (dungeons[key]  != undefined) {
                                dungeons[key] += char[key];
                                dungeons["Total"] += char[key];
                            } else if (gms[key]  != undefined) {
                                gms[key] += char[key];
                                gms["Total"] += char[key];
                            }
                        });
                    });
                    dbUser.stats = stats;
                    dbUser.raids = raids;
                    dbUser.dungeons = dungeons;
                    dbUser.grandmasters = gms;
                    this.d2client.DB.set(userid, dbUser);
                    res(dbUser);
                }).catch(e => console.log(e));
            });
        });
    }
}