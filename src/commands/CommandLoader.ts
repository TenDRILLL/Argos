import {
    readdirSync
} from "fs";
import Command from "./Command";

export async function load(): Promise<Map<string, Command>> {
    return new Promise(res => {
        const commands: Map<string, Command> = new Map();
        console.log("Loading commands...");
        const commandFiles = readdirSync(`${__dirname}`).filter(x => x.endsWith(".js"));
        const commandTable: Object = {};
        const promises: Array<Promise<boolean>> = [];
        commandFiles.forEach(name => {
            promises.push(new Promise(res => {
                import(`./${name}`).then(file => {
                    const js = new(<any>Object.entries(file)[0][1]);
                    if(!(js instanceof Command)) return;
                    const name = js.getName();
                    commands.set(name,js);
                    commandTable[name] = {loaded: true};
                    res(true);
                }).catch(() => res(false));
            }));
        });
        Promise.all(promises).then(() => {
            console.table(commandTable);
            console.log("\nCommands loaded.");
            res(commands);
        });
    });
}