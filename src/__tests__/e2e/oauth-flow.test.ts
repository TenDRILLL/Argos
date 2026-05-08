import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";

// Full OAuth round-trip E2E test with mocked external APIs
const dbAvailable = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS);
const maybeDescribe = dbAvailable ? describe : describe.skip;

const mockAxiosPost = mock(() => Promise.resolve({
    data: {
        access_token: "e2e_access_token",
        expires_in: 3600,
        refresh_token: "e2e_refresh_token",
        refresh_expires_in: 7776000,
        membership_id: "987654321098765432",
        scope: "identify",
        token_type: "Bearer"
    }
}));
const mockAxiosGet = mock(() => Promise.resolve({
    data: {
        id: "123456789012345678",
        username: "e2e_testuser",
        displayName: "E2EGuardian",
        uniqueName: "E2EGuardian#0001"
    }
}));

mock.module("axios", () => ({
    default: { post: mockAxiosPost, get: mockAxiosGet },
    post: mockAxiosPost,
    get: mockAxiosGet
}));

maybeDescribe("OAuth flow E2E", () => {
    beforeAll(async () => {
        process.env.DB_NAME = "argos_test";
        process.env.DISCORD_ID = "test_app";
        process.env.DISCORD_SECRET = "test_secret";
        process.env.DISCORD_OAUTH = "https://example.com/oauth";
        process.env.ARGOS_ID_PASSWORD = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

        const { initDatabase } = await import("../../automata/Database");
        await initDatabase();
    });

    afterAll(async () => {
        const { dbQuery } = await import("../../automata/Database");
        await dbQuery("SET FOREIGN_KEY_CHECKS = 0");
        for (const t of ["users", "user_tokens", "user_activities", "lfg", "lfg_members", "misc", "discordToken"]) {
            await dbQuery(`TRUNCATE TABLE ${t}`);
        }
        await dbQuery("SET FOREIGN_KEY_CHECKS = 1");
    });

    it("GET /authorization?code=d2code redirects to Discord OAuth URL", async () => {
        const request = await import("supertest");
        const express = (await import("express")).default;
        const { default: authorizationRouter } = await import("../../web/endpoints/authorization");
        const app = express();
        app.use("/authorization", authorizationRouter);
        const res = await (request as any)(app).get("/authorization?code=e2e_d2_code");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("discord.com/api/oauth2/authorize");
        expect(res.headers.location).toContain("state=e2e_d2_code");
    });

    it("discordOauthExchange writes discordToken row", async () => {
        const { discordOauthExchange } = await import("../../automata/DiscordTokenManager");
        await discordOauthExchange("e2e_dc_code");
        const { dbQuery } = await import("../../automata/Database");
        const rows = await dbQuery("SELECT id FROM discordToken WHERE id = ?", ["123456789012345678"]);
        expect(rows.length).toBe(1);
    });
});
