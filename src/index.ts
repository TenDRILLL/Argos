import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {ApplicationCommandOptionType, Client, Emoji} from "discord-http-interactions";
import {statRoles} from "./enums/statRoles";
import {load} from "./commands/CommandLoader";
import {getErrorPage, getPanelPage, getPreload, landingPage, logout} from "./handlers/htmlPages";
import {readdirSync} from "fs";
import * as cron from "node-cron";
import { crypt, decrypt } from "./utils/crypt";
import { newRegistration } from "./utils/newRegistration";
import { fetchPendingClanRequests } from "./utils/fetchPendingClanRequests";
import { getXurEmbed } from "./utils/getXurEmbed";
import { instantiateActivityDatabase, updateActivityIdentifierDB } from "./utils/updateActivityIdentifierDB";

let commands;
const dcclient = new Client({
    token: process.env.discordToken as string,
    publicKey: process.env.discordKey as string,
    port: 11542,
    endpoint: "/api/interactions",
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
        }, {
            name: "getError",
            method: "GET",
            endpoint: "/error"
        }, {
            name: "undefined",
            method: "GET",
            endpoint: "*"
        }
    ]
});
const d2client = new requestHandler(dcclient);

dcclient.app.use(/^\/(?!.*(api\/interaction)).{0,99}/,bodyParser.urlencoded({ extended: false }));
dcclient.app.use(/^\/(?!.*(api\/interaction)).{0,99}/,bodyParser.json());
dcclient.app.use(/^\/(?!.*(api\/interaction)).{0,99}/,cookieParser());

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

dcclient.on("site",(req,res)=>{
    res.send(landingPage());
});

dcclient.on("db",(req,res)=>{
    if(req.params.id === undefined) {
        return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    } else {
        const dID = decrypt(process.env.argosIdPassword as string,req.params.id);
        if(d2client.DB.has(dID)){
            res.json(d2client.DB.get(dID));
        } else {
            return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        }
    }
});

dcclient.on("authorization", (req, res) => {
    if(req.url.split("?").length < 2){
        return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    }
    if(req.url.split("?")[1].split("=").length !== 2 || req.url.split("?")[1].split("=")[0] !== "code") {
        return res.redirect(`/error?message=
            Destiny 2 oAuth2 Code Error. Please try again.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
    }
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&state=${req.url.split("=")[1]}&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections`)
});

dcclient.on("oauthPreload",(req,res)=>{
    res.send(getPreload(`/api/oauth?${req.url.split("?")[1]}`));
});

dcclient.on("oauth", (req,res)=>{
    if(req.url.split("?").length < 2){
        return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    }
    let urlData: {code: string | undefined, state: string | undefined, error: string | undefined, error_description: string | undefined} = {code: undefined, state: undefined, error: undefined, error_description: undefined};
    req.url.split("?")[1].split("&").forEach(x => {const param = x.split("=");if(param.length === 2 && param[1] !== "") urlData[param[0]] = param[1];});
    if(urlData.code === undefined || urlData.state === undefined){
        if(urlData.error && urlData.error_description){
            console.log(`${urlData.error.toUpperCase()}: ${urlData.error_description.split("+").join(" ")}.`);
            return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.
                            
                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer`);
        } else if(urlData.state === undefined) {
            d2client.discordTokens.discordOauthExchange(urlData.code).then(dcuser => {
                d2client.DB.set(dcuser.id,dcuser,"discordUser");
                return res.cookie("conflux", crypt(process.env.argosIdPassword as string, dcuser.id)).redirect("/panel");
            }).catch(e => {
                console.log(e);
                return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.
                            
                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer
                &button=register`);
            });
        } else {
            return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        }
    } else {
        const discordCode = urlData.code;
        const bungieCode = urlData.state;
        newRegistration(dcclient, d2client, discordCode, bungieCode, res);
    }
});

dcclient.on("undefined", (req,res)=>{
    return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
});

dcclient.on("register",(req, res)=>{
    if(req.params.account === undefined || req.cookies["conflux"] === undefined){
        return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    }
    const account = decrypt(process.env.argosRegisterPassword as string,req.params.account).split("/seraph/");
    const discordID = decrypt(process.env.argosIdPassword as string,req.cookies["conflux"]);
    if(account.length !== 2) return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    //Account 0 = type
    //Account 1 = id
    if(!d2client.DB.has(discordID)) return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
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
    d2client.dbUserUpdater.updateUserRoles(dcclient,d2client,discordID);
});

dcclient.on("panelPreload",(req,res)=>{
    res.send(getPreload("/api/panel"));
});

dcclient.on("panel",(req,res)=>{
    let discID = "";
    if(req.cookies["conflux"]){
        discID = decrypt(process.env.argosIdPassword as string,req.cookies["conflux"]);
    }
    if(d2client.DB.has(discID)){
        d2client.dbUserUpdater.updateStats(discID).then((data)=>{
            if(data.destinyId === undefined || data.membershipType === undefined) {
                return res.redirect(`/error?message=
                Destiny 2 oAuth2 Code Error. Please try again.
                                        
                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
            }
            d2client.discordTokens.getDiscordInformation(discID).then(dcuser => {
                getPanelPage(d2client, discID, data, dcuser).then(resp => {
                    res.send(resp);
                }).catch(e => {
                    console.log(e);
                    res.redirect(`/error?message=
                    Panel could not be loaded.
                            
                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
                });
            }).catch(e => {
                getPanelPage(d2client, discID, data, data.discordUser).then(resp => {
                    res.send(resp);
                }).catch(e => {
                    console.log(e);
                    res.redirect(`/error?message=
                    Panel could not be loaded.
                            
                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
                });
            });
        });
    } else {
        res.redirect(`/error?message=
        Could not find user registration, please make sure you have registered to Argos.
        
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Oracle
        &button=Register`);
    }
});

dcclient.on("getError",(req,res)=>{
    res.send(getErrorPage(req.query.message.split("\\n"), req.query.button ?? "Register"))
})

dcclient.on("logout",(req,res)=>{
    res.clearCookie("conflux").send(logout());
});

dcclient.on("resource",(req, res)=>{
    if(req.params.resourceName === undefined){
        return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    }
    const resources = readdirSync("./html/styles");
    if(resources.includes(req.params.resourceName)){
        res.sendFile(`${__dirname}/html/styles/${req.params.resourceName}`);
    } else {
        return res.redirect(`/error?message=
        Resource ${req.params.resourceName} does not exist.
                            
        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Atheon`);
    }
});

dcclient.on("ready", async ()=>{
    commands = await load();
    console.log(`BungoAPIShits http://localhost:${dcclient.port}/`);
    setInterval(()=>{
        console.log(`Updating statroles, Date: ${new Date().toUTCString()}`);
        d2client.dbUserUpdater.updateAllUserRoles(dcclient,d2client);
        console.log("Checking clan requests.");
        fetchPendingClanRequests(dcclient,d2client);
    },5*60*1000);
    //XUR Embed timers while Argos running.
    const createXur = cron.schedule("5 17 * * 5", ()=>{
        generateXurEmbed();
    }, {timezone: "etc/UTC"});
    const deleteXur = cron.schedule("5 17 * * 2", ()=>{
        deleteXurEmbed();
    }, {timezone: "etc/UTC"});
    createXur.start();
    deleteXur.start();
    //XUR Embed checking on Argos startup.
    const now = new Date();
    //0 = Sun
    if(now.getDay() !== 3 && now.getDay() !== 4){
        //Day is Fri-Tue
        if(now.getDay() === 2){
            //Tue
            if(now.getUTCHours() >= 17){
                deleteXurEmbed();
            } else {
                generateXurEmbed();
            }
        } else if(now.getDay() === 5){
            //Fri
            if(now.getUTCHours() < 17){
                deleteXurEmbed();
            } else {
                generateXurEmbed();
            }
        } else {
            generateXurEmbed();
        }
    } else {
        deleteXurEmbed();
    }
});

function deleteXurEmbed(){
    if(d2client.miscDB.has("xurEmbed")){
        console.log(`Deleting XUR embed and emojies: ${new Date().toISOString()}`);
        d2client.miscDB.delete("xurEmbed");
        dcclient.getEmoji("990974785674674187").then((emojies) => {
            return !(emojies instanceof Emoji) ? emojies.forEach(emoji => {
                dcclient.removeEmoji("990974785674674187", emoji.id);
            }) : dcclient.removeEmoji("990974785674674187", emojies.id);
        });
    }
}

function generateXurEmbed(){
    if(!(d2client.miscDB.has("xurEmbed"))){
        console.log(`Generating XUR embed: ${new Date().toISOString()}`);
        getXurEmbed(d2client, dcclient).then(x => {
            console.log("XUR embed saved.");
            d2client.miscDB.set("xurEmbed",x);
        });
    } else {
        console.log("XUR embed exists.");
    }
}

if (d2client.activityIdentifierDB.size == 0) { //In case activityIdentifierDB is empty
    instantiateActivityDatabase(d2client);
    updateActivityIdentifierDB(d2client);
}

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
            name: "leaderboard",
            description: "Display the leaderboard for the requested statistic.",
            options: [
                {
                    name: "name",
                    type: ApplicationCommandOptionType.String,
                    description: "Name of the leaderboard.",
                    required: true,
                    autocomplete: true
                }
            ]
        }, {
            name: "symbols",
            description: "Check the locations of symbols in order to gain a Deepsight weapon at the end of the activity.",
            options: [
                {
                    name: "activity",
                    type: ApplicationCommandOptionType.String,
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
                    type: ApplicationCommandOptionType.SubCommand,
                    name: "summary",
                    description: "Requested user's general statistics Argos monitors.",
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: ApplicationCommandOptionType.SubCommand,
                    name: "raids",
                    description: "Requested user's raid completions per raid.",
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: ApplicationCommandOptionType.SubCommand,
                    name: "dungeons",
                    description: "Requested user's dungeon completions per dungeon.",
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }, {
                    type: ApplicationCommandOptionType.SubCommand,
                    name: "grandmasters",
                    description: "Requested user's Grandmaster Nightfall completions per Grandmaster Nightfall.",
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "The Discord user whose stats you wish to request.",
                            required: false
                        }
                    ]
                }
            ]
        }, {
            name: "lfg",
            description: "Access LFG commands.",
            options: [
                {
                    name: "create",
                    description: "Create an LFG.",
                    type: ApplicationCommandOptionType.SubCommand,
                    options: [
                        {
                            name: "type",
                            description: "Type of an activity to create an LFG for.",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            required: true
                        }, {
                            name: "activity",
                            description: "The activity to create an LFG for.",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            required: true
                        }
                    ]
                }, {
                    name: "timezone",
                    description: "Set your timezone for LFG.",
                    type: ApplicationCommandOptionType.SubCommand,
                    options: [
                        {
                            name: "set",
                            description: "Set your timezone for LFG.",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                            required: true
                        }
                    ]
                }
            ]
        }
    ]);
}