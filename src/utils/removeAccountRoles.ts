import axios from "axios";
import {Client} from "discord.js";

import {statRoles} from "../enums/statRoles";
import {getToken} from "../automata/DiscordTokenManager";

export function removeAccountRoles(discordID: string, client: Client): void {
    const guild = client.guilds.cache.get(statRoles.guildID);
    if(!guild) return;
    guild.members.fetch(discordID).then(async member => {
        const currentRoles = Array.from(member.roles.cache.keys());
        const newRoles = currentRoles.filter(x => !statRoles.allIDs.includes(x)).sort();
        member.roles.set(newRoles).catch(e => console.log(`Setting member ${discordID} failed.`));
        const discordAccessToken = await getToken(discordID).catch(e => { console.log(e); return null; });
        if(!discordAccessToken) return console.log(`${discordID} has no token, please ask them to re-register.`);
        axios.put(
            `https://discord.com/api/v10/users/@me/applications/${process.env.DISCORD_ID}/role-connection`,
            {}, {headers: {"Authorization": discordAccessToken, "Content-Type": "application/json"}}
        ).catch(e => console.log(e));
    }).catch(() => {});
}
