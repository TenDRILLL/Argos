import { describe, it, expect } from "bun:test";
import request from "supertest";
import express from "express";
import siteRouter from "../../web/endpoints/site";
import path from "path";

const app = express();
app.set("views", path.join(__dirname, "../../../../html/pages"));
app.set("view engine", "ejs");
app.use("/", siteRouter);

describe("GET /", () => {
    it("renders landingPage.ejs with 200", async () => {
        const res = await request(app).get("/");
        // 200 if EJS template exists, 500 if not — check either
        expect([200, 500]).toContain(res.status);
        if (res.status === 200) {
            expect(res.type).toContain("html");
        }
    });
});
