import {Router} from "express";
import {Client} from "discord.js";

import {dbQuery} from "../../automata/Database";
import {userService} from "../../automata/UserService";
import {statRoles} from "../../enums/statRoles";
import {decrypt} from "../../utils/crypt";

export default function makeRegisterRouter(client: Client): Router {
    const router = Router();
    router.get("/:account", async (req, res) => {
        if(req.params.account === undefined || req.cookies["conflux"] === undefined){
            return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        }
        const account: string | void = await decrypt(process.env.ARGOS_REGISTER_PASSWORD as string,req.params.account).catch(e => console.log(e));
        const discordID = await decrypt(process.env.ARGOS_ID_PASSWORD as string,req.cookies["conflux"]).catch(e => console.log(e));
        if(!account || account.split("/seraph/").length !== 2) return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        //Account 0 = type
        //Account 1 = id
        if(!discordID) return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discordID]);
        if(rows.length < 1) return res.redirect(`/error?message=
            Turn back now... Darkness is too strong in here.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        await dbQuery("UPDATE users SET destiny_id=?, membership_type=? WHERE discord_id=?", [account.split("/seraph/")[1], account.split("/seraph/")[0], discordID]);
        res.redirect("/panel");
        const guild = client.guilds.cache.get(statRoles.guildID);
        guild?.members.fetch(discordID).then(member => {
            if(!member) return;
            if(member.roles.cache.has(statRoles.registeredID)) return;
            const roles = [...Array.from(member.roles.cache.keys()), statRoles.registeredID];
            member.roles.set(roles).catch(e => console.log(e));
        });
        userService.updateUserRoles(client, discordID);
    });
    return router;
}
