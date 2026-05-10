import {Router} from "express";
import {Client} from "discord.js";

import {dbQuery} from "../../automata/Database";
import {removeAccountRoles} from "../../utils/removeAccountRoles";
import {decrypt} from "../../utils/crypt";

export default function makeUnregisterRouter(client: Client): Router {
    const router = Router();
    router.get("/", async (req, res) => {
        let discID: string | void = "";
        if(req.cookies["conflux"]){
            discID = await decrypt(process.env.ARGOS_ID_PASSWORD as string,req.cookies["conflux"]).catch(e => console.log(e));
        }
        if(discID){
            const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discID]);
            if(rows.length > 0){
                await dbQuery("DELETE FROM user_activities WHERE discord_id = ?", [discID]);
                await dbQuery("DELETE FROM user_tokens WHERE discord_id = ?", [discID]);
                await dbQuery("DELETE FROM discordToken WHERE id = ?", [discID]);
                await dbQuery("DELETE FROM users WHERE discord_id = ?", [discID]);
                removeAccountRoles(discID, client);
            }
        }
        res.clearCookie("conflux").render("logout.ejs");
    });
    return router;
}
