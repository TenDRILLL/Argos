import "dotenv/config";
import initDiscordBot from "./bot/bot";
import {initDatabase} from "./automata/Database";
import loadCommands from "./automata/CommandLoader";
import {setCommands} from "./bot/events/InteractionCreate";
import {initWeb} from "./web/web";
import {lfgManager} from "./automata/LFGManager";
import {patternService} from "./automata/PatternService";

console.log("Starting Argos...");
initDatabase().then(()=>{
    console.log("Database connected, starting Discord component...");
    return initDiscordBot();
}).then(client =>{
    return loadCommands().then(commands =>{
        setCommands(commands);
        return client;
    });
}).then(client =>{
    lfgManager.init(client);
    patternService.init().catch(e => console.error("PatternService init failed:", e));
    initWeb(parseInt(process.env.WEB_PORT ?? "11542"), client);
}).catch(e => {
    console.error("Fatal startup error:", e);
    process.exit(1);
});
