import {Router} from "express";

const router = Router();
router.get("/", (req, res) => {
    res.render("landingPage.ejs");
});
export default router;
