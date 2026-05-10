import {Client} from "discord.js";
import {readdirSync} from "fs";
import DiscordEvent from "../structs/DiscordEvent";

export default function loadDiscordEvents(client: Client){
    console.log("Loading Discord Events...");
    return new Promise(res => {
        readdirSync("./bot/events").forEach(f => {
            if(!f.endsWith(".js")) return console.log(`Non-event file in folder: ${f}`);
            const js: any = new (require(`../bot/events/${f}`).default)();
            if(!(js instanceof DiscordEvent)) return console.log(`Non-event file in folder: ${f}`);
            console.log(`${js.getEventName()} loaded.`);
            js.isOnce() ?
                client.once(js.getEventName(), (...args) => js.exec(client, ...args))
                : client.on(js.getEventName(), (...args) => js.exec(client, ...args));
        });
        res(true);
    });
}