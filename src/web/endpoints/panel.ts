import {Router} from "express";

import {dbQuery} from "../../automata/Database";
import {userService} from "../../automata/UserService";
import {getDiscordInformation} from "../../automata/DiscordTokenManager";
import {getPanelPageVariables} from "../../utils/getPanelPageVariables";
import {decrypt} from "../../utils/crypt";

const router = Router();
router.get("/", async (req, res) => {
    console.log(`[panel] hit — cookie present=${!!req.cookies["conflux"]}`);
    let discID: string | void = "";

    if(!req.cookies["conflux"]){
        return res.redirect("/");
    }

    discID = await decrypt(process.env.ARGOS_ID_PASSWORD as string, req.cookies["conflux"]).catch(e => {
        console.log(`[panel] cookie decrypt failed:`, e);
    });
    console.log(`[panel] decrypted discord id=${discID || "FAILED"}`);
    if(!discID){
        console.log(`[panel] no discID — clearing cookie, redirecting Oracle`);
        return res.clearCookie("conflux").redirect(`/error?message=
        Could not find user registration, please make sure you have registered to Argos.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Oracle
        &button=Register`);
    }
    const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discID]);
    console.log(`[panel] DB lookup rows=${rows.length}`);
    if(rows.length < 1){
        console.log(`[panel] user not in DB — clearing cookie, redirecting Oracle`);
        return res.clearCookie("conflux").redirect(`/error?message=
        Could not find user registration, please make sure you have registered to Argos.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Oracle
        &button=Register`);
    }
    console.log(`[panel] calling updateStats for ${discID}`);
    userService.updateStats(discID).then((data)=>{
        console.log(`[panel] updateStats done — destiny_id=${data.destiny_id} membership_type=${data.membership_type}`);
        if(data.destiny_id === undefined || data.membership_type === undefined) {
            console.log(`[panel] missing destiny data — redirecting Shrieker`);
            return res.redirect(`/error?message=
                Destiny 2 oAuth2 Code Error. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
        }
        console.log(`[panel] fetching discord info`);
        getDiscordInformation(discID as string).then(dcuser => {
            console.log(`[panel] discord info ok, building page vars`);
            getPanelPageVariables(discID as string, data, dcuser).then(resp => {
                console.log(`[panel] rendering panel.ejs`);
                res.render('panel.ejs', { data: resp });
            })
            .catch(e => {
                console.log(`[panel] getPanelPageVariables failed:`, e);
                res.redirect(`/error?message=
                    Panel could not be loaded.

                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
            });
        }).catch((e) => {
            console.log(`[panel] getDiscordInformation failed (continuing without):`, e);
            getPanelPageVariables(discID as string, data, null).then(resp => {
                console.log(`[panel] rendering panel.ejs (no discord info)`);
                res.render('panel.ejs', { data: resp });
            })
            .catch(e => {
                console.log(`[panel] getPanelPageVariables failed (no discord info):`, e);
                res.redirect(`/error?message=
                    Panel could not be loaded.

                    \\n
                    For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
            });
        });
    }).catch(e => {
        console.log(`[panel] updateStats failed:`, e);
        res.redirect(`/error?message=
            Panel could not be loaded.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Servitor`);
    });
});
export default router;
