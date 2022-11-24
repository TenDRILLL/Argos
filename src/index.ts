import Express from "express";
import { URLSearchParams } from "url";
import { verifyKey } from "discord-interactions";
import bodyParser from "body-parser";
import "dotenv/config";
import enmap from "enmap";

import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";

const d2client = new requestHandler(process.env.apikey);
const dcclient = new discordHandler(process.env.discordKey);
const app = Express();
const port = 11542;
const clientID = "37090";
const DB = new enmap({name:"users"});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(Express.json({verify: VerifyDiscordRequest(process.env.discordKey)}));
app.use(bodyParser.json());


app.get("/",(req,res)=>{
    res.sendFile(`${__dirname}/crota.html`);
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

function handleRegistration(interaction){
    const code = interaction.data.options[0].value;
    const discordID = interaction.member.user.id;
    const data = new URLSearchParams();
    data.append("grant_type","authorization_code");
    data.append("code", code);
    data.append("client_id",clientID);
    d2client.token(data).then(x => {
        //@ts-ignore
        if(x.membership_id){//@ts-ignore
            dcclient.interactionReply(interaction,
                {
                    content: "Registration successful!",
                    flags: 64
                }
            );//@ts-ignore
            DB.set(discordID,{destinyID: x.membership_id});
        } else {
            dcclient.interactionReply(interaction,
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