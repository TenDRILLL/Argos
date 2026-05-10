import {Router} from "express";

const router = Router();
router.get("/{*path}", (req, res) => {
    console.log(`[catchall] unmatched route: ${req.method} ${req.path} query=${JSON.stringify(req.query)}`);
    return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
});
export default router;
