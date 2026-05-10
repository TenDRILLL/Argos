import {Router} from "express";
import {Client} from "discord.js";
import rateLimit from "express-rate-limit";

import {newRegistration as _newRegistrationDefault} from "../../automata/RegistrationService";
import {discordOauthExchange} from "../../automata/DiscordTokenManager";
import {crypt} from "../../utils/crypt";

const oauthLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

export default function makeOauthRouter(client: Client, newRegistration: typeof _newRegistrationDefault = _newRegistrationDefault): Router {
    const router = Router();
    router.use(oauthLimiter);
    router.get("/", (req, res) => {
        const { code, state, error, error_description } = req.query as {
            code?: string;
            state?: string;
            error?: string;
            error_description?: string;
        };
        console.log(`[oauth] hit — code=${code ? "present" : "missing"} state=${state ?? "none"} error=${error ?? "none"}`);

        if(error){
            console.log(`[oauth] discord error: ${error.toUpperCase()}: ${error_description ?? ""}`);
            return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer`);
        }

        if(code === undefined){
            console.log(`[oauth] no code in query — aborting`);
            return res.redirect(`/error?message=
                Turn back now... Darkness is too strong in here.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
        }

        if(state === undefined){
            console.log(`[oauth] no state — login flow, exchanging code`);
            discordOauthExchange(code).then(async dcuser => {
                console.log(`[oauth] exchange ok — discord id=${dcuser.id}, encrypting conflux cookie`);
                const conflux = await crypt(process.env.ARGOS_ID_PASSWORD as string, dcuser.id);
                console.log(`[oauth] cookie set, redirecting to /panel`);
                return res.cookie("conflux", conflux, {expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/panel");
            }).catch(e => {
                console.log(`[oauth] exchange failed:`, e);
                return res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.

                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer
                &button=register`);
            });
        } else {
            console.log(`[oauth] state present — registration flow`);
            newRegistration(client, code, state, res);
        }
    });
    return router;
}
