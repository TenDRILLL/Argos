import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import {requestHandler} from "./handlers/requestHandler";
import {Client} from "discord-http-interactions";
import {
    fetchPendingClanRequests,
    newRegistration,
    updateStatRoles,
    decrypt,
    updateStatRolesUser,
    GetDiscordInformation,
    crypt,
    GetDiscordOauthExchange
} from "./handlers/utils";
import {statRoles} from "./enums/statRoles";
import {load} from "./commands/CommandLoader";
import {getPanelPage, getPreload, logout, unauthenticatedPanel} from "./handlers/htmlPages";
import {readdirSync} from "fs";

let commands;
const d2client = new requestHandler();
const dcclient = new Client({
    token: process.env.discordToken as string,
    publicKey: process.env.discordKey as string,
    port: 11542,
    endpoint: "/api/interactions",
    linkedRolesEndpoint: "/api/linkedroles",
    additionalEndpoints: [
        {
            name: "site",
            method: "GET",
            endpoint: "/"
        }, {
            name: "db",
            method: "GET",
            endpoint: "/db/:id"
        }, {
            name: "authorization",
            method: "GET",
            endpoint: "/authorization"
        }, {
            name: "oauth",
            method: "GET",
            endpoint: "/api/oauth"
        }, {
            name: "oauthPreload",
            method: "GET",
            endpoint: "/oauth"
        }, {
            name: "register",
            method: "GET",
            endpoint: "/register/:account"
        }, {
            name: "panel",
            method: "GET",
            endpoint: "/api/panel"
        }, {
            name: "panelPreload",
            method: "GET",
            endpoint: "/panel"
        }, {
            name: "logout",
            method: "GET",
            endpoint: "/logout"
        }, {
            name: "resource",
            method: "GET",
            endpoint: "/resource/:resourceName"
        }
    ]
});

dcclient.app.use(bodyParser.urlencoded({ extended: false }));
dcclient.app.use(bodyParser.json());
dcclient.app.use(cookieParser());

dcclient.on("interaction", interaction => {
    if(commands === undefined) return; //This shouldn't really happen, but there's a slight possibility when the bot is starting.
    const case1 = interaction.customId?.split("-")[0];
    const case2 = interaction.commandName;
    const case3 = interaction.message?.interaction?.name;
    if(case1 !== undefined && commands.has(case1)){
        commands.get(case1)!.run(interaction, d2client);
    } else if(case2 !== undefined && commands.has(case2)){
        commands.get(case2)!.run(interaction, d2client);
    } else if(case3 !== undefined && commands.has(case3)){
        commands.get(case3)!.run(interaction, d2client);
    } else {
        interaction.reply({content: "Not implemented yet."}).catch(e => console.log(e)); //This catches in case a command is missing, to avoid the request not being handled.
    }
});

dcclient.on("linkedRoles", data =>{ //Will be used to check how discord sends the data and appearantly will be the thing we update the roles with?!
    console.log(data);
});

dcclient.on("site",(req,res)=>{
    res.sendFile(`${__dirname}/html/crota.html`);
});

dcclient.on("db",(req,res)=>{
    if(req.params.id === undefined) {
        res.send(`<body><style>body {background-color: #111; color: #FFF; padding: 140px 0 0 0;}h1 { background-color: rgba(256,256,256,.03); background-image: -webkit-linear-gradient(top, #111, #0c0c0c); background-image: -moz-linear-gradient(top, #111, #0c0c0c); background-image: -ms-linear-gradient(top, #111, #0c0c0c); background-image: -o-linear-gradient(top, #111, #0c0c0c); font-size: 2em; font-family: 'Amethysta', serif; text-align: center; line-height: 1.4em; text-transform: uppercase; letter-spacing: .3em; white-space:nowrap;}span { color: #000; font-family: 'Caesar Dressing', cursive; font-size: 5em; text-transform: lowercase; vertical-align: middle; letter-spacing: .2em;}.fire { animation: animation 1s ease-in-out infinite alternate; -moz-animation: animation 1s ease-in-out infinite alternate; -webkit-animation: animation 1s ease-in-out infinite alternate; -o-animation: animation 1s ease-in-out infinite alternate;}.burn { animation: animation .65s ease-in-out infinite alternate; -moz-animation: animation .65s ease-in-out infinite alternate; -webkit-animation: animation .65s ease-in-out infinite alternate; -o-animation: animation .65s ease-in-out infinite alternate;}@keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-moz-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-webkit-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-o-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}</style><link href='https://fonts.googleapis.com/css?family=Amethysta' rel='stylesheet' type='text/css'><link href='https://fonts.googleapis.com/css?family=Caesar+Dressing' rel='stylesheet' type='text/css'><h1><span class="fire">U</span><span class="burn">n</span><span class="burn">a</span><span class="burn">u</span><span class="burn">t</span><span class="burn">h</span><span class="burn">o</span><span class="burn">r</span><span class="burn">i</span><span class="burn">z</span><span class="burn">e</span><span class="fire">d</span></h1><br><br><h1>[ Error code: 871 ]<br>This incident will be reported.</h1></body>`);
    } else {
        const dID = decrypt("zavala",req.params.id);
        if(d2client.DB.has(dID)){
            res.json(d2client.DB.get(dID));
        } else {
            res.send(`<body><style>body {background-color: #111; color: #FFF; padding: 140px 0 0 0;}h1 { background-color: rgba(256,256,256,.03); background-image: -webkit-linear-gradient(top, #111, #0c0c0c); background-image: -moz-linear-gradient(top, #111, #0c0c0c); background-image: -ms-linear-gradient(top, #111, #0c0c0c); background-image: -o-linear-gradient(top, #111, #0c0c0c); font-size: 2em; font-family: 'Amethysta', serif; text-align: center; line-height: 1.4em; text-transform: uppercase; letter-spacing: .3em; white-space:nowrap;}span { color: #000; font-family: 'Caesar Dressing', cursive; font-size: 5em; text-transform: lowercase; vertical-align: middle; letter-spacing: .2em;}.fire { animation: animation 1s ease-in-out infinite alternate; -moz-animation: animation 1s ease-in-out infinite alternate; -webkit-animation: animation 1s ease-in-out infinite alternate; -o-animation: animation 1s ease-in-out infinite alternate;}.burn { animation: animation .65s ease-in-out infinite alternate; -moz-animation: animation .65s ease-in-out infinite alternate; -webkit-animation: animation .65s ease-in-out infinite alternate; -o-animation: animation .65s ease-in-out infinite alternate;}@keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-moz-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-webkit-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}@-o-keyframes animation{0% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #feec85, -20px -20px 40px #ffae34, 20px -40px 50px #ec760c, -20px -60px 60px #cd4606, 0 -80px 70px #973716, 10px -90px 80px #451b0e;}100% {text-shadow: 0 0 20px #fefcc9, 10px -10px 30px #fefcc9, -20px -20px 40px #feec85, 22px -42px 60px #ffae34, -22px -58px 50px #ec760c, 0 -82px 80px #cd4606, 10px -90px 80px #973716;}}</style><link href='https://fonts.googleapis.com/css?family=Amethysta' rel='stylesheet' type='text/css'><link href='https://fonts.googleapis.com/css?family=Caesar+Dressing' rel='stylesheet' type='text/css'><h1><span class="fire">U</span><span class="burn">n</span><span class="burn">a</span><span class="burn">u</span><span class="burn">t</span><span class="burn">h</span><span class="burn">o</span><span class="burn">r</span><span class="burn">i</span><span class="burn">z</span><span class="burn">e</span><span class="fire">d</span></h1><br><br><h1>[ Error code: 871 ]<br>This incident will be reported.</h1></body>`);
        }
    }
});

dcclient.on("authorization", (req, res) => {
    if(req.url.split("?")[1].split("=").length !== 2 || req.url.split("?")[1].split("=")[0] !== "code") return res.send("ERROR: No registration code found.");
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&state=${req.url.split("=")[1]}&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections`)
});

dcclient.on("oauthPreload",(req,res)=>{
    res.send(getPreload(`/api/oauth?${req.url.split("?")[1]}`));
});

dcclient.on("oauth", (req,res)=>{
    if(req.url.split("?").length < 2){return res.send("You should not be here on your own.");}
    let urlData: {code: string | undefined, state: string | undefined, error: string | undefined, error_description: string | undefined} = {code: undefined, state: undefined, error: undefined, error_description: undefined};
    req.url.split("?")[1].split("&").forEach(x => {const param = x.split("=");if(param.length === 2 && param[1] !== "") urlData[param[0]] = param[1];});
    if(urlData.code === undefined || urlData.state === undefined){
        if(urlData.error && urlData.error_description){
            return res.send(`${urlData.error.toUpperCase()}: ${urlData.error_description.split("+").join(" ")}.`);
        } else if(urlData.state === undefined) {
            GetDiscordOauthExchange(urlData.code).then(dcdata => {
                d2client.DB.set(dcdata.user.id,dcdata.user,"discordUser");
                d2client.DB.set(dcdata.user.id,dcdata.tokens,"discordTokens");
                return res.cookie("conflux", crypt("zavala", dcdata.user.id)).redirect("/panel");
            }).catch(e => {
                return res.send(e.message);
            });
        } else {
            return res.send("You should not be here on your own.");
        }
    } else {
        const discordCode = urlData.code;
        const bungieCode = urlData.state;
        newRegistration(dcclient, d2client, discordCode, bungieCode, res);
    }
});

dcclient.on("register",(req, res)=>{
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
    updateStatRolesUser(dcclient,d2client,discordID);
});

dcclient.on("panelPreload",(req,res)=>{
    res.send(getPreload("/api/panel"));
});

dcclient.on("panel",(req,res)=>{
    let discID = "";
    if(req.cookies["conflux"]){
        discID = decrypt("zavala",req.cookies["conflux"]);
    }
    if(d2client.DB.has(discID)){
        d2client.dbUserUpdater.updateStats(discID).then((data)=>{
            GetDiscordInformation(d2client,discID).then(dcuser => {
                getPanelPage(d2client, discID, data, dcuser).then(resp => {
                    res.send(resp);
                }).catch(e => {
                    res.send(e);
                });
            }).catch(e => {
                getPanelPage(d2client, discID, data, data.discordUser).then(resp => {
                    res.send(resp);
                }).catch(e => {
                    res.send(e);
                });
            });
        });
    } else {
        res.send(unauthenticatedPanel());
    }
});

dcclient.on("logout",(req,res)=>{
    res.clearCookie("conflux").send(logout());
});

dcclient.on("resource",(req, res)=>{
    if(req.params.resourceName === undefined){
        return res.send("You should not be here on your own.");
    }
    const resources = readdirSync("./html");
    if(resources.includes(req.params.resourceName)){
        res.sendFile(`${__dirname}/html/${req.params.resourceName}`);
    } else {
        res.status(404).send(`${req.params.resourceName} resource doesn't exist.`);
    }
});

dcclient.on("ready", async ()=>{
    commands = await load();
    console.log(`BungoAPIShits http://localhost:${dcclient.port}/`);
    setInterval(()=>{
        console.log(`Updating statroles, Date: ${new Date().toUTCString()}`);
        updateStatRoles(dcclient,d2client);
        console.log("Checking clan requests.");
        fetchPendingClanRequests(dcclient,d2client);
    },5*60*1000);
});

dcclient.login();

//Use this if you need to change the commands.
//updateCmds();

function updateCmds(){
    dcclient.registerCommands(
        process.env.discordId as string,
        [
        {
            name: "registrationlink",
            description: "Send registration link."
        }, {
            name: "xur",
            description: "Check items offered by xûr."
        }, {
            name: "symbols",
            description: "Check the locations of symbols in order to gain a Deepsight weapon at the end of the activity.",
            options: [
                {
                    name: "activity",
                    type: 3,
                    description: "Please select the activity from the list below.",
                    required: true,
                    autocomplete: true
                }
            ]
        }, {
            name: "d2stats",
            description: "Get Destiny 2 statistics of yourself or the requested user.",
            options: [
                {
                    type: 1,
                    name: "summary",
                    description: "Requested user's general statistics Argos monitors.",
                    options: [
                        {
                            type: 6,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: 1,
                    name: "raids",
                    description: "Requested user's raid completions per raid.",
                    options: [
                        {
                            type: 6,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: 1,
                    name: "dungeons",
                    description: "Requested user's dungeon completions per dungeon.",
                    options: [
                        {
                            type: 6,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: 1,
                    name: "grandmasters",
                    description: "Requested user's Grandmaster Nightfall completions per Grandmaster Nightfall.",
                    options: [
                        {
                            type: 6,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }
            ]
        }
    ]);
}