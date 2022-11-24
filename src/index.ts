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
    res.send(`Here's your registration code: ${req.url.split("=")[1]}
Please return to Discord, and use the /register command to finalize your registration.`);
});

app.post("/api/interactions", async (req,res)=>{
    const interaction = req.body;
    if(interaction.type === 1) return dcclient.ping(res);
    if(interaction.type === 2) {
        if(interaction.data.name === "register"){
            handleRegistration(interaction);
        }
        res.status(200);
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
    await dcclient.defer(interaction);
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
                        //reply.profiles.map()
                        dcclient.editReply(interaction,
                            {
                                content: "You need to choose which account you wish to use!",
                                flags: 64
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