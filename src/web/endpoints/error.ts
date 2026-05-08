import {Router} from "express";

const router = Router();
router.get("/", (req, res) => {
    res.render("errorPage.ejs", { errorDetails: (req.query.message as string)?.split("\\n"), button: req.query.button });
});
export default router;
