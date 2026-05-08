import {readdirSync} from "fs";
import DiscordCommand from "../structs/DiscordCommand";

export default function loadCommands(): Promise<Map<string, DiscordCommand>> {
    return new Promise(res => {
        const commands: Map<string, DiscordCommand> = new Map();
        const table: {name: string, loaded: boolean}[] = [];

        readdirSync("./bot/commands").forEach(f => {
            if(!f.endsWith(".js")) return;
            const cmd: any = new (require(`../bot/commands/${f}`).default)();
            if(!(cmd instanceof DiscordCommand)){
                table.push({name: f, loaded: false});
                return;
            }
            commands.set(cmd.getName(), cmd);
            table.push({name: cmd.getName(), loaded: true});
        });

        console.table(table);
        res(commands);
    });
}
