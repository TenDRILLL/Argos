import {Router} from "express";

const router = Router();
router.get("/", (req, res) => {
    const clientId = process.env.DISCORD_ID as string;
    const redirectUri = encodeURIComponent(process.env.DISCORD_OAUTH as string);
    const discordOauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20role_connections.write%20connections`;
    res.render("landingPage.ejs", {discordOauthUrl});
});
export default router;
