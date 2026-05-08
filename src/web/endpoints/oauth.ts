import {Router} from "express";
import {Client} from "discord.js";

import {newRegistration} from "../../automata/RegistrationService";
import {discordOauthExchange} from "../../automata/DiscordTokenManager";
import {crypt} from "../../utils/crypt";

export default function makeOauthRouter(client: Client): Router {
    const router = Router();
    router.get("/", (req, res) => {
        const { code, state, error, error_description } = req.query as {
            code?: string;
            state?: string;
            error?: string;
            error_description?: string;
        };

        if(error){
            console.log(`${error.toUpperCase()}: ${error_description ?? ""}`);
            return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer`);
        }

        if(code === undefined){
            return res.redirect(`/error?message=
                Turn back now... Darkness is too strong in here.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        }

        if(state === undefined){
            discordOauthExchange(code).then(async dcuser => {
                const conflux = await crypt(process.env.ARGOS_ID_PASSWORD as string, dcuser.id);
                return res.cookie("conflux", conflux, {expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/panel");
            }).catch(e => {
                console.log(e);
                return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer
                &button=register`);
            });
        } else {
            newRegistration(client, code, state, res);
        }
    });
    return router;
}
