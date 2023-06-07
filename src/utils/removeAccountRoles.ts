import axios from "axios";
import { statRoles } from "../enums/statRoles";

export function removeAccountRoles(discordID, dcclient, d2client) {
    dcclient.getMember(statRoles.guildID,discordID).then(async member => {
        let data: { nick?: string, roles: string[] } = {
            roles: []
        };
        const roles = member.roles.sort();
        data.roles = roles.filter(x => !statRoles.allIDs.includes(x));
        data.roles = [...data.roles].sort();
        dcclient.setMember(statRoles.guildID,discordID,data).catch(e => console.log(`Setting member ${discordID} failed.`));
        //Remove linked roles data?
        const discordAccessToken = await d2client.discordTokens.getToken(discordID)
                .catch(e => console.log(e));
        if(!discordAccessToken) return console.log(`${discordID} has no token, please ask them to re-register.`);
        axios.put(`https://discord.com/api/v10/users/@me/applications/${process.env.discordId}/role-connection`,
                    {},{headers: {"Authorization": discordAccessToken, "Content-Type": "application/json"}}).catch(e => console.log(e));
    }).catch(e => {});//Member not on the server.
}