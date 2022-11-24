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

app.get("/db",(req,res)=>{
    res.send(JSON.stringify(Array.from(DB.entries())));
});

app.get("/authorization", (req, res) => {
    res.send(`
<style>
    body {background-color:#000000;background-repeat:no-repeat;background-position:top left;background-attachment:fixed;}
    h1{font-family:Arial, sans-serif;color:#000000;background-color:#000000;}
    p {text-align:center;font-family:Georgia, serif;font-size:16px;font-style:normal;font-weight:normal;color:#ffffff;background-color:#000000;}
</style>
<h1></h1>
<p>Your unique registration code:</p>
<p><b>${req.url.split("=")[1]}</b></p>
<p>Please return to Discord, and use the /register command to finalize your registration.</p>
`);
});

app.post("/api/interactions", async (req,res)=>{
    const interaction = req.body;
    if(interaction.type === 1) return dcclient.ping(res);
    if(interaction.type === 2) {
        if(interaction.data.name === "register"){
            handleRegistration(interaction);
        }
        res.status(200);
    } else if(interaction.type === 3){
        if(interaction.message.interaction.name === "register"){
             let dbUser = DB.get(interaction.member.user.id);
             dbUser["destinyId"] = interaction.data.custom_id;
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
                        DB.set(discordID,{bungieId: id, destinyId: primary.membershipId});
                        dcclient.editReply(interaction,
                            {
                                content: "Registration successful!",
                                flags: 64
                            }
                        );
                    } else {
                        if(reply.profiles.length === 1){
                            DB.set(discordID,{bungieId: id, destinyId: reply.profiles[0].membershipId});
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
                                custom_id: x.membershipId
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


/*
https://www.bungie.net/en/OAuth/Authorize?client_id=37090&response_type=code
Code: b90d7797d7c970c3f6b81d7b288d70e5
APIKEY: 336f250b411a44f9a90db0464f3ad2fc
GET: /GroupV2/{GroupId}/Members
Clan ID: 3506545
*/