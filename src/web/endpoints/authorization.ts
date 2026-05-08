import {Router} from "express";

const router = Router();
router.get("/", (req, res) => {
    const { code } = req.query as { code?: string };
    if(!code){
        return res.redirect(`/error?message=
            Destiny 2 oAuth2 Code Error. Please try again.

            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
    }
    const clientId = process.env.DISCORD_ID as string;
    const redirectUri = encodeURIComponent(process.env.DISCORD_OAUTH as string);
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&state=${code}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20role_connections.write%20connections`);
});
export default router;
