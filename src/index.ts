import Express from "express";
import bodyParser from "body-parser";

import {requestHandler} from "./handlers/requestHandler";
import {discordHandler, Interaction} from "./handlers/discordHandler";
import {fetchPendingClanRequests, updateStatRoles, VerifyDiscordRequest} from "./handlers/utils";
import {RawInteraction} from "./props/discord";

const d2client = new requestHandler();
const dcclient = new discordHandler();
const app = Express();
const port = 11542;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(Express.json({verify: VerifyDiscordRequest()}));
app.use(bodyParser.json());

app.get("/",(req,res)=>{
    res.sendFile(`${__dirname}/html/crota.html`);
});

app.get("/db",(req,res)=>{
    res.send(`<body><style>body {background-color: #111; color: #FFF; padding: 140px 0 0 0;}h1 { background-color: rgba(256,256,256,.03); background-image: -webkit-linear-gradient(top, #111, #0c0c0c); background-image: -moz-linear-gradient(top, #111, #0c0c0c); background-image: -ms-linear-gradient(top, #111, #0c0c0c); background-image: -o-linear-gradient(top, #111, #0c0c0c); font-size: 2em; font-family: 'Amethysta', serif; text-align: center; line-height: 1.4em; text-transform: uppercase; letter-spacing: .3em; white-space:nowrap;}span { color: #000; font-family: 'Caesar Dressing', cursive; font-size: 5em; text-transform: lowercase; vertical-align: middle; letter-spacing: .2em;}.fire { animation: animation 1s ease-in-out infinite alternate; -moz-animation: animation 1s ease-in-out infinite alternate; -webkit-animation: animation 1s ease-in-out infinite alternate; -o-animation: animation 1s ease-in-out infinite alternate;}.burn { animation: animation .65s ease-in-out infinite alternate; -moz-animation: animation .65s ease-in-out infinite alternate; -webkit-animation: animation .65s ease-in-out infinite alternate; -o-animation: animation .65s ease-in-out infinite alternate;}@keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-moz-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-webkit-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-o-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}</style><link href='https://fonts.googleapis.com/css?family=Amethysta' rel='stylesheet' type='text/css'><link href='https://fonts.googleapis.com/css?family=Caesar+Dressing' rel='stylesheet' type='text/css'><h1><span class="fire">U</span><span class="burn">n</span><span class="burn">a</span><span class="burn">u</span><span class="burn">t</span><span class="burn">h</span><span class="burn">o</span><span class="burn">r</span><span class="burn">i</span><span class="burn">z</span><span class="burn">e</span><span class="fire">d</span></h1><br><br><h1>[ Error code: 871 ]<br>This incident will be reported.</h1></body>`);
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
    if(dcclient.commands === undefined) return; //This shouldn't really happen, but there's a slight possibility when the bot is starting.
    const data = req.body as RawInteraction;
    if(data.type === 1) return res.send({type: 1});
    const interaction = new Interaction(data, dcclient);
    const case1 = interaction.data["custom_id"]?.split("-")[0];
    const case2 = interaction.data["name"];
    const case3 = interaction.message?.interaction?.name;
    if(case1 !== undefined && dcclient.commands.has(case1)){
        dcclient.commands.get(case1)!.run(interaction, d2client);
    } else if(case2 !== undefined && dcclient.commands.has(case2)){
        dcclient.commands.get(case2)!.run(interaction, d2client);
    } else if(case3 !== undefined && dcclient.commands.has(case3)){
        dcclient.commands.get(case3)!.run(interaction, d2client);
    } else {
        interaction.reply({content: "Not implemented yet."}).catch(e => console.log(e)); //This catches in case a command is missing, to avoid the request not being handled.
    }
    res.status(200);
});

app.listen(port, ()=>{
    console.log(`BungoAPIShits http://localhost:${port}/`);
    setInterval(()=>{
        console.log(`Updating statroles, Date: ${new Date().toUTCString()}`);
        updateStatRoles(dcclient,d2client);
        console.log("Checking clan requests.");
        fetchPendingClanRequests(dcclient,d2client);
    },5*60*1000);
});