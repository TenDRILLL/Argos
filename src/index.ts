import Express from "express";
import bodyParser from "body-parser";
import "dotenv/config";
import enmap from "enmap";

import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import {testRaids, VerifyDiscordRequest} from "./handlers/utils";

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
    if(interaction.type === 2) { // /command
        if(interaction.data.name === "register"){
            d2client.handleRegistration(interaction,dcclient,clientID,DB);
        } else if(interaction.data.name === "testraids"){
            testRaids(interaction,dcclient,d2client,DB);
        }
    } else if(interaction.type === 3){ // Button
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