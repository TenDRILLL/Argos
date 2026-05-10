import {Router} from "express";

const router = Router();
router.get("/", (_req, res) => {
    res.render("preload.ejs", {url: "/api/panel"});
});
export default router;
