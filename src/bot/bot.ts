import { Client, GatewayIntentBits } from 'discord.js';
import loadDiscordEvents from "../automata/DiscordEventLoader";

export default function initDiscordBot(): Promise<Client> {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildIntegrations,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.DirectMessageReactions
        ]
    });

    return loadDiscordEvents(client).then(async ()=>{
        console.log("Discord events loaded, logging in...");
        await client.login();
        return client;
    });
}
