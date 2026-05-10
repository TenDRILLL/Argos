import "dotenv/config";
import {REST, Routes} from "discord.js";
import {readdirSync} from "fs";
import DiscordCommand from "./structs/DiscordCommand";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_ID;

if (!token || !clientId) {
    console.error("DISCORD_TOKEN and DISCORD_ID must be set in .env");
    process.exit(1);
}

const commands: object[] = [];

readdirSync("./bot/commands").forEach(f => {
    if (!f.endsWith(".js")) return;
    const cmd: any = new (require(`./bot/commands/${f}`).default)();
    if (!(cmd instanceof DiscordCommand)) return;
    const slashCommand = cmd.getSlashCommand();
    if (slashCommand) {
        commands.push(slashCommand);
        console.log(`  + ${cmd.getName()}`);
    }
});

console.log(`Deploying ${commands.length} commands globally...`);

const rest = new REST().setToken(token);

rest.put(Routes.applicationCommands(clientId), { body: commands })
    .then(() => console.log("Done."))
    .catch(e => { console.error(e); process.exit(1); });
