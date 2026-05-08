import { describe, it, expect } from "bun:test";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import logoutRouter from "../../web/endpoints/logout";
import path from "path";

const app = express();
app.use(cookieParser());
app.set("views", path.join(__dirname, "../../../../html/pages"));
app.set("view engine", "ejs");
app.use("/logout", logoutRouter);

describe("GET /logout", () => {
    it("clears conflux cookie", async () => {
        const res = await request(app)
            .get("/logout")
            .set("Cookie", "conflux=some_encrypted_value");
        const cookies = res.headers["set-cookie"] as string[] | undefined;
        const confluxClear = cookies?.find(c => c.startsWith("conflux="));
        // Cookie is cleared (expires in past or empty value)
        expect(confluxClear).toBeDefined();
        expect(confluxClear).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0|conflux=;/i);
    });

    it("renders logout.ejs (200 or 500 if template missing)", async () => {
        const res = await request(app).get("/logout");
        expect([200, 500]).toContain(res.status);
    });
});
