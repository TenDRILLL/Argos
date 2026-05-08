import {Router} from "express";

import {dbQuery} from "../../automata/Database";
import {userService} from "../../automata/UserService";
import {getDiscordInformation} from "../../automata/DiscordTokenManager";
import {getPanelPageVariables} from "../../utils/getPanelPageVariables";
import {decrypt} from "../../utils/crypt";

const router = Router();
router.get("/", async (req, res) => {
    let discID: string | void = "";
    if(req.cookies["conflux"]){
        discID = await decrypt(process.env.ARGOS_ID_PASSWORD as string,req.cookies["conflux"]).catch(e => console.log(e));
    }
    if(!discID){
        return res.clearCookie("conflux").redirect(`/error?message=
        Could not find user registration, please make sure you have registered to Argos.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Oracle
        &button=Register`);
    }
    const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discID]);
    if(rows.length < 1){
        return res.clearCookie("conflux").redirect(`/error?message=
        Could not find user registration, please make sure you have registered to Argos.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Oracle
        &button=Register`);
    }
    userService.updateStats(discID).then((data)=>{
        if(data.destiny_id === undefined || data.membership_type === undefined) {
            return res.redirect(`/error?message=
                Destiny 2 oAuth2 Code Error. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
        }
        getDiscordInformation(discID as string).then(dcuser => {
            getPanelPageVariables(discID as string, data, dcuser).then(resp => {
                res.render('panel.ejs', { data: resp })
            })
            .catch(e => {
                console.log(e);
                res.redirect(`/error?message=
                    Panel could not be loaded.

                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
            });
        }).catch(() => {
            getPanelPageVariables(discID as string, data, null).then(resp => {
                res.render('panel.ejs', { data: resp })
            })
            .catch(e => {
                console.log(e);
                res.redirect(`/error?message=
                    Panel could not be loaded.

                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
            });
        });
    });
});
export default router;
