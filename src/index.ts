import Express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import {requestHandler} from "./handlers/requestHandler";
import {discordHandler, Interaction} from "./handlers/discordHandler";
import {fetchPendingClanRequests, newRegistration, updateStatRoles, VerifyDiscordRequest, decrypt} from "./handlers/utils";
import {RawInteraction} from "./props/discord";
import {statRoles} from "./enums/statRoles";

const d2client = new requestHandler();
const dcclient = new discordHandler();
const app = Express();
const port = 11542;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(Express.json({verify: VerifyDiscordRequest()}));
app.use(bodyParser.json());
app.use(cookieParser());

app.get("/",(req,res)=>{
    res.sendFile(`${__dirname}/html/crota.html`);
});

app.get("/db",(req,res)=>{
    res.send(`<body><style>body {background-color: #111; color: #FFF; padding: 140px 0 0 0;}h1 { background-color: rgba(256,256,256,.03); background-image: -webkit-linear-gradient(top, #111, #0c0c0c); background-image: -moz-linear-gradient(top, #111, #0c0c0c); background-image: -ms-linear-gradient(top, #111, #0c0c0c); background-image: -o-linear-gradient(top, #111, #0c0c0c); font-size: 2em; font-family: 'Amethysta', serif; text-align: center; line-height: 1.4em; text-transform: uppercase; letter-spacing: .3em; white-space:nowrap;}span { color: #000; font-family: 'Caesar Dressing', cursive; font-size: 5em; text-transform: lowercase; vertical-align: middle; letter-spacing: .2em;}.fire { animation: animation 1s ease-in-out infinite alternate; -moz-animation: animation 1s ease-in-out infinite alternate; -webkit-animation: animation 1s ease-in-out infinite alternate; -o-animation: animation 1s ease-in-out infinite alternate;}.burn { animation: animation .65s ease-in-out infinite alternate; -moz-animation: animation .65s ease-in-out infinite alternate; -webkit-animation: animation .65s ease-in-out infinite alternate; -o-animation: animation .65s ease-in-out infinite alternate;}@keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-moz-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-webkit-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-o-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}</style><link href='https://fonts.googleapis.com/css?family=Amethysta' rel='stylesheet' type='text/css'><link href='https://fonts.googleapis.com/css?family=Caesar+Dressing' rel='stylesheet' type='text/css'><h1><span class="fire">U</span><span class="burn">n</span><span class="burn">a</span><span class="burn">u</span><span class="burn">t</span><span class="burn">h</span><span class="burn">o</span><span class="burn">r</span><span class="burn">i</span><span class="burn">z</span><span class="burn">e</span><span class="fire">d</span></h1><br><br><h1>[ Error code: 871 ]<br>This incident will be reported.</h1></body>`);
});

app.get("/authorization", (req, res) => {
    if(req.url.split("?")[1].split("=").length !== 2 || req.url.split("?")[1].split("=")[0] !== "code") return res.send("ERROR: No registration code found.");
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&state=${req.url.split("=")[1]}&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Fapi%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections`)
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

app.post("/api/linkedroles",(req,res)=>{ //Will be used to check how discord sends the data and appearantly will be the thing we update the roles with?!
    console.log(req.body);
    res.status(200);
});

app.get("/api/oauth",(req,res)=>{ //Not used for anything rn, but Discord wanted it so we can invite the bot with rolespermissionwrite.
    if(req.url.split("?").length < 2){return res.send("You should not be here on your own.");}
    let urlData: {code: string | undefined, state: string | undefined, error: string | undefined, error_description: string | undefined} = {code: undefined, state: undefined, error: undefined, error_description: undefined};
    req.url.split("?")[1].split("&").forEach(x => {const param = x.split("=");if(param.length === 2 && param[1] !== "") urlData[param[0]] = param[1];});
    if(urlData.code === undefined || urlData.state === undefined){if(urlData.error && urlData.error_description){return res.send(`${urlData.error.toUpperCase()}: ${urlData.error_description.split("+").join(" ")}.`);} else {return res.send("You should not be here on your own.");}}
    const discordCode = urlData.code;
    const bungieCode = urlData.state;
    newRegistration(dcclient, d2client, discordCode, bungieCode, res);
});

app.get("/register/:account",(req, res)=>{
    if(req.params.account === undefined || req.cookies["conflux"] === undefined){
        return res.send("You should not be here on your own.");
    }
    const account = decrypt("malahayati",req.params.account).split("/seraph/");
    const discordID = decrypt("zavala",req.cookies["conflux"]);
    if(account.length !== 2) return res.send("You should not be here on your own.");
    //Account 0 = type
    //Account 1 = id
    if(!d2client.DB.has(discordID)) return res.send("You shouldn't be here on your own.");
    let dbUser = d2client.DB.get(discordID);
    dbUser["destinyId"] = account[1];
    dbUser["membershipType"] = account[0];
    d2client.DB.set(discordID,dbUser);
    res.redirect("/panel");
    dcclient.getMember(statRoles.guildID,discordID).then(member => {
        if(!member) return;
        //@ts-ignore
        if(member.roles.includes(statRoles.registeredID)) return;
        //@ts-ignore
        let roles = [...member.roles as string[], statRoles.registeredID];
        //@ts-ignore
        dcclient.setMember(statRoles.guildID,member.user.id,{roles}).catch(e => console.log(e));
    });
});

app.get("/panel",(req,res)=>{
    if(req.cookies["conflux"]){
        res.send(JSON.stringify(d2client.DB.get(decrypt("zavala",req.cookies["conflux"]))));
    } else {
        res.send("Soon™️");
    }
});

app.get("/logout",(req,res)=>{
    res.clearCookie("conflux").send("Logged out.");
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