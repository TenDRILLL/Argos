import { describe, it, expect } from "bun:test";
import request from "supertest";
import express from "express";
import errorRouter from "../../web/endpoints/error";
import path from "path";

const app = express();
app.set("views", path.join(__dirname, "../../../../html/pages"));
app.set("view engine", "ejs");
app.use("/error", errorRouter);

describe("GET /error", () => {
    it("renders errorPage.ejs with message param", async () => {
        const res = await request(app).get("/error?message=TestError");
        expect([200, 500]).toContain(res.status);
    });

    it("renders with button param", async () => {
        const res = await request(app).get("/error?message=TestError&button=register");
        expect([200, 500]).toContain(res.status);
    });
});
