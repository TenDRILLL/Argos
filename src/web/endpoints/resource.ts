import {Router} from "express";
import {readdirSync} from "fs";
import path from "path";

const router = Router();
router.get("/:resourceName", (req, res) => {
    if(req.params.resourceName === undefined){
        return res.redirect(`/error?message=
        Turn back now... Darkness is too strong in here.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: OOB`);
    }
    const htmlRoot = path.resolve(__dirname, '../..', 'html');
    const styles = readdirSync(path.join(htmlRoot, "styles"));
    const scripts = readdirSync(path.join(htmlRoot, "scripts"));
    const images = readdirSync(path.join(htmlRoot, "images"));
    if(styles.includes(req.params.resourceName)){
        res.sendFile(path.join(htmlRoot, "styles", req.params.resourceName));
    } else if(scripts.includes(req.params.resourceName)){
        res.sendFile(path.join(htmlRoot, "scripts", req.params.resourceName));
    } else if(images.includes(req.params.resourceName)){
        res.sendFile(path.join(htmlRoot, "images", req.params.resourceName));
    } else {
        return res.redirect(`/error?message=
        Resource ${req.params.resourceName} does not exist.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Atheon`);
    }
});
export default router;
