import {BungieProfile} from "../props/bungieProfile";
import {RaidObject} from "../props/RaidObject";
import {CharacterQuery} from "../props/characterQuery";
import {ActivityQuery} from "../props/activity";
import {activityIdentifiers} from "../enums/activityIdentifiers";
import {verifyKey} from "discord-interactions";

export async function getBungieName(id,d2client){
    return new Promise((res)=>{
        d2client.apiRequest("getBungieProfile",{id}).then(data => {
            const resp = data.Response as BungieProfile;
            res(resp.displayName);
        });
    });
}

export async function testRaids(interaction,dcclient,d2client,DB){
    const discordID = interaction.data.options ? interaction.data.options[0].value : interaction.member.user.id;
    if(!DB.has(discordID)) return dcclient.interactionReply(interaction,{content: "The requested user has not registered with me."});
    dcclient.defer(interaction,{});
    const dbUser = DB.get(discordID);
    const raidObject = await getRaids(dbUser,d2client);
    const bungoName = await getBungieName(dbUser.bungieId,d2client);
    const embed = {
        "title": `Raid completions: ${bungoName}`,
        "color": 11413503,
        "description": `**${raidObject["Total"]}** total clears.`,
        "footer": {
            "icon_url": "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp",
            "text": "Argos, Planetary Core"
        },
        "fields": [
            {
                "name": "\u200B",
                "value":
                    `**King's Fall**
${raidObject["King's Fall, Legend"] + raidObject["King's Fall, Master"]} - M: ${raidObject["King's Fall, Master"]}

**Vault of Glass**
${raidObject["Vault of Glass, Normal"] + raidObject["Vault of Glass, Master"]} - M: ${raidObject["Vault of Glass, Master"]}

**Garden of Salvation**
${raidObject["Garden of Salvation"]}

**Crown of Sorrow**
${raidObject["Crown of Sorrow"]}

**Spire of Stars**
${raidObject["Leviathan, Spire of Stars, Normal"] + raidObject["Leviathan, Spire of Stars, Prestige"]} - P: ${raidObject["Leviathan, Spire of Stars, Prestige"]}

**Leviathan**
${raidObject["Leviathan, Normal"] + raidObject["Leviathan, Prestige"]} - P: ${raidObject["Leviathan, Prestige"]}`,
                "inline":true
            },
            {
                "name": "\u200B",
                "value":
                    `**Vow of the Disciple**
${raidObject["Vow of the Disciple, Normal"] + raidObject["Vow of the Disciple, Master"]} - M: ${raidObject["Vow of the Disciple, Master"]}

**Deep Stone Crypt**
${raidObject["Deep Stone Crypt"]}

**Last Wish**
${raidObject["Last Wish"]}

**Scourge of the Past**
${raidObject["Scourge of the Past"]}

**Eater of Worlds**
${raidObject["Leviathan, Eater of Worlds, Normal"] + raidObject["Leviathan, Eater of Worlds, Prestige"]} - P: ${raidObject["Leviathan, Eater of Worlds, Prestige"]}`,
                "inline":true
            }
        ]
    };
    dcclient.editReply(interaction,{
        embeds: [embed]
    });
}

async function getRaids(dbUser,d2client): Promise<RaidObject>{
    return new Promise(res => {
        d2client.apiRequest("getDestinyCharacters",{destinyMembershipId: dbUser.destinyId, membershipType: dbUser.membershipType}).then(d => {
            const resp = d.Response as CharacterQuery;
            const promises: Promise<RaidObject>[] = [];
            resp.characters.forEach(character => {
                promises.push(new Promise((res)=>{
                    d2client.apiRequest("getActivityStats",{destinyMembershipId: dbUser.destinyId, membershipType: dbUser.membershipType, characterId: character.characterId}).then(d => {
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
                const obj = {
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
                res(obj);
            }).catch(e => console.log(e));
        });
    });
}

export function VerifyDiscordRequest(clientKey) {
    return function (req, res, buf, encoding) {
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");
        const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
        if (!isValidRequest) {
            res.status(401).send("Bad request signature");
        }
    };
}