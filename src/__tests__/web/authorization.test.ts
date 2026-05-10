import { describe, it, expect, beforeAll } from "bun:test";
import request from "supertest";
import authorizationRouter from "../../web/endpoints/authorization";
import express from "express";

const app = express();
app.use("/authorization", authorizationRouter);

describe("GET /authorization", () => {
    beforeAll(() => {
        process.env.DISCORD_ID = "test_client_id_12345";
        process.env.DISCORD_OAUTH = "https://example.com/oauth/callback";
    });

    it("?code=XYZ redirects to Discord OAuth URL", async () => {
        const res = await request(app).get("/authorization?code=test_d2_code");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("discord.com/api/oauth2/authorize");
    });

    it("redirect URL contains DISCORD_ID from env (not hardcoded)", async () => {
        const res = await request(app).get("/authorization?code=test_code");
        expect(res.headers.location).toContain("test_client_id_12345");
    });

    it("redirect URL contains encoded DISCORD_OAUTH from env", async () => {
        const res = await request(app).get("/authorization?code=test_code");
        const encoded = encodeURIComponent("https://example.com/oauth/callback");
        expect(res.headers.location).toContain(encoded);
    });

    it("redirect URL contains code as state param", async () => {
        const res = await request(app).get("/authorization?code=my_d2_state_code");
        expect(res.headers.location).toContain("state=my_d2_state_code");
    });

    it("(no code) redirects to /error with Shrieker code", async () => {
        const res = await request(app).get("/authorization");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
        expect(res.headers.location).toContain("Shrieker");
    });
});
