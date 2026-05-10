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
    let styles: string[], scripts: string[], images: string[];
    try {
        styles = readdirSync(path.join(htmlRoot, "styles"));
        scripts = readdirSync(path.join(htmlRoot, "scripts"));
        images = readdirSync(path.join(htmlRoot, "images"));
    } catch {
        return res.status(404).send("Resource not found.");
    }
    const safeServe = (subdir: string) => {
        const resolved = path.resolve(htmlRoot, subdir, req.params.resourceName);
        if (!resolved.startsWith(htmlRoot + path.sep)) return res.status(400).send("Invalid resource path.");
        res.sendFile(resolved);
    };
    if(styles.includes(req.params.resourceName)){
        safeServe("styles");
    } else if(scripts.includes(req.params.resourceName)){
        safeServe("scripts");
    } else if(images.includes(req.params.resourceName)){
        safeServe("images");
    } else {
        return res.redirect(`/error?message=
        Resource ${req.params.resourceName} does not exist.

        \\n
        For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Atheon`);
    }
});
export default router;
