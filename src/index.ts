import Express from "express";
import { URLSearchParams } from "url";
import { verifyKey } from "discord-interactions";
import bodyParser from "body-parser";
import "dotenv/config";
import enmap from "enmap";

import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import {BungieProfile} from "./props/bungieProfile";
import {LinkedProfileResponse} from "./props/linkedProfileResponse";
import {CharacterQuery} from "./props/characterQuery";
import {RaidObject} from "./props/RaidObject";
import {Activity, ActivityQuery} from "./props/activity";
import {activityIdentifiers} from "./enums/activityIdentifiers";

const d2client = new requestHandler(process.env.apikey);
const dcclient = new discordHandler(process.env.discordKey,process.env.discordId);
const app = Express();
const port = 11542;
const clientID = "37090";
const DB = new enmap({name:"users"});
const emoji = ["", {name: "Xbox", id: "1045358581316321280", animated:false}, {name: "PlayStation", id: "1045354080794595339", animated:false}, {name: "Steam", id: "1045354053087006800", animated:false}];
const style = ["",3,1,2];

app.use(bodyParser.urlencoded({ extended: false }));
app.use(Express.json({verify: VerifyDiscordRequest(process.env.discordKey)}));
app.use(bodyParser.json());


app.get("/",(req,res)=>{
    res.sendFile(`${__dirname}/html/crota.html`);
});

app.get("/authorization", (req, res) => {
    res.send(`
<style>
    body {background-color:#36393f;background-repeat:no-repeat;background-position:top left;background-attachment:fixed;}
    h1 {font-family:Arial, sans-serif; text-align: center;}
    h2 {font-family:Arial, sans-serif; text-align: center;}
    div{left: 50%; position: absolute; top: 50%; transform: translate(-50%, -50%);}
</style>
<div>
    <h2 style="color:white">Your unique registration code:</h2>
    <h1 style="color:white"><b>${req.url.split("=")[1]}</b></h1>
    <h2 style="color:white">Please return to Discord, and use the
    <span style="background: #414776; font-family: Uni Sans,serif;">/register</span>
    command to finalize your registration.</h2>
</div>
`);
});

app.post("/api/interactions", async (req,res)=>{
    const interaction = req.body;
    if(interaction.type === 1) return dcclient.ping(res);
    if(interaction.type === 2) {
        if(interaction.data.name === "register"){
            handleRegistration(interaction);
        } else if(interaction.data.name === "testraids"){
            testRaids(interaction);
        }
    } else if(interaction.type === 3){
        if(interaction.message.interaction.name === "register"){
             let dbUser = DB.get(interaction.member.user.id);
             dbUser["destinyId"] = interaction.data.custom_id.split("-")[0];
             dbUser["membershipType"] = interaction.data.custom_id.split("-")[1];
             DB.set(interaction.member.user.id,dbUser);
             dcclient.update(interaction,{
                 content: "Registration successful!",
                 components: [],
                 flags: 64
             });
        }
    } else {
        res.status(400);
    }
    res.status(200);
});

app.listen(port, ()=>{
    console.log(`BungoAPIShits http://localhost:${port}/`);
});

function VerifyDiscordRequest(clientKey) {
    return function (req, res, buf, encoding) {
        const signature = req.get("X-Signature-Ed25519");
        const timestamp = req.get("X-Signature-Timestamp");
        const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
        if (!isValidRequest) {
            res.status(401).send("Bad request signature");
        }
    };
}

async function handleRegistration(interaction){
    await dcclient.defer(interaction,{flags: 64});
    const code = interaction.data.options[0].value;
    const discordID = interaction.member.user.id;
    const data = new URLSearchParams();
    data.append("grant_type","authorization_code");
    data.append("code", code);
    data.append("client_id",clientID);
    d2client.token(data).then(x => {
        //@ts-ignore
        let id = x.membership_id;
        if(id){
            d2client.apiRequest("getBungieProfile",{id}).then(profile => {
                const reply = profile.Response as BungieProfile;
                let membershipType;
                if(reply.steamDisplayName){membershipType = 3} else if(reply.xboxDisplayName){membershipType = 1} else if(reply.psnDisplayName){membershipType = 2} else {return;}
                d2client.apiRequest("getBungieLinkedProfiles",{membershipType, membershipId: id}).then(resp => {
                    const reply = resp.Response as LinkedProfileResponse;
                    const primary = reply.profiles.find(x => x.isCrossSavePrimary);
                    if(primary){
                        DB.set(discordID,{bungieId: id, destinyId: primary.membershipId, membershipType: primary.membershipType});
                        dcclient.editReply(interaction,
                            {
                                content: "Registration successful!",
                                flags: 64
                            }
                        );
                    } else {
                        if(reply.profiles.length === 1){
                            DB.set(discordID,{bungieId: id, destinyId: reply.profiles[0].membershipId, membershipType: reply.profiles[0].membershipType});
                            return dcclient.editReply(interaction,
                                {
                                    content: "Registration successful!",
                                    flags: 64
                                }
                            );
                        }
                        DB.set(discordID,{bungieId: id});
                        const buttons = reply.profiles.map(x => {
                            return {
                                type: 2,
                                label: x.displayName,
                                style: style[x.membershipType],
                                emoji: emoji[x.membershipType],
                                custom_id: `${x.membershipId}-${x.membershipType}`
                            }
                        });
                        dcclient.editReply(interaction,
                            {
                                content: "Please select your primary account/platform.",
                                flags: 64,
                                components: [
                                    {
                                        type: 1,
                                        components: buttons
                                    }
                                ]
                            }
                        );
                    }
                });
            });
        } else {
            dcclient.editReply(interaction,
                {
                    content: "Registration failed, please generate a new code.",
                    flags: 64
                }
            );
        }
    });
}

async function testRaids(interaction){
    const discordID = interaction.data.options ? interaction.data.options[0].value : interaction.member.user.id;
    if(!DB.has(discordID)) return dcclient.interactionReply(interaction,{content: "The requested user has not registered with me."});
    dcclient.defer(interaction,{});
    const dbUser = DB.get(discordID);
    const raidObject = await getRaids(dbUser);
    const bungoName = await getBungieName(dbUser.bungieId);
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
${raidObject["King's Fall, Legend"] + raidObject["King's Fall, Master"]} M:(${raidObject["King's Fall, Master"]})

**Vault of Glass**
${raidObject["Vault of Glass, Normal"] + raidObject["Vault of Glass, Master"]} M:(${raidObject["Vault of Glass, Master"]})

**Garden of Salvation**
${raidObject["Garden of Salvation"]}

**Crown of Sorrow**
${raidObject["Crown of Sorrow"]}

**Spire of Stars**
${raidObject["Leviathan, Spire of Stars, Normal"] + raidObject["Leviathan, Spire of Stars, Prestige"]} P:(${raidObject["Leviathan, Spire of Stars, Prestige"]})

**Leviathan**
${raidObject["Leviathan, Normal"] + raidObject["Leviathan, Prestige"]} P:(${raidObject["Leviathan, Prestige"]})`,
                    "inline":true
                },
                {
                    "name": "\u200B",
                    "value":
`**Vow of the Disciple**
${raidObject["Vow of the Disciple, Normal"] + raidObject["Vow of the Disciple, Master"]} M:(${raidObject["Vow of the Disciple, Master"]})

**Deep Stone Crypt**
${raidObject["Deep Stone Crypt"]}

**Last Wish**
${raidObject["Last Wish"]}

**Scourge of the Past**
${raidObject["Scourge of the Past"]}

**Eater of Worlds**
${raidObject["Leviathan, Eater of Worlds, Normal"] + raidObject["Leviathan, Eater of Worlds, Prestige"]} P:(${raidObject["Leviathan, Eater of Worlds, Prestige"]})`,
                    "inline":true
                }
            ]
    };
    dcclient.editReply(interaction,{
        embeds: [embed]
    });
}

async function getRaids(dbUser): Promise<RaidObject>{
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
                        }
                    });
                });
                res(obj);
            }).catch(e => console.log(e));
        });
    });
}

async function getBungieName(id){
    return new Promise((res)=>{
        d2client.apiRequest("getBungieProfile",{id}).then(data => {
            const resp = data.Response as BungieProfile;
            res(resp.displayName);
        });
    });
}



/*
https://www.bungie.net/en/OAuth/Authorize?client_id=37090&response_type=code
Code: b90d7797d7c970c3f6b81d7b288d70e5
APIKEY: 336f250b411a44f9a90db0464f3ad2fc
GET: /GroupV2/{GroupId}/Members
Clan ID: 3506545
*/