import {Router} from "express";

const router = Router();
router.get("/", (req, res) => {
    res.clearCookie("conflux").render("logout.ejs");
});
export default router;
