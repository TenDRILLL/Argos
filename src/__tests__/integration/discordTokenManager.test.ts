import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from "bun:test";

// regression: MariaDB $N placeholder bug — saveTokens must use ? not $1
// Mock axios before import
const mockPost = mock(() => Promise.resolve({
    data: {
        access_token: "new_token",
        expires_in: 3600,
        refresh_token: "new_refresh",
        scope: "identify",
        token_type: "Bearer"
    }
}));
const mockGet = mock(() => Promise.resolve({
    data: {
        id: "123456789012345678",
        username: "testuser",
        discriminator: "0001"
    }
}));

mock.module("axios", () => ({
    default: { post: mockPost, get: mockGet },
    post: mockPost,
    get: mockGet
}));

import { setupTestDb, teardownTestDb, clearAllTables } from "../helpers/db";
import { dbQuery } from "../../automata/Database";
import { getToken, discordOauthExchange } from "../../automata/DiscordTokenManager";

const dbAvailable = !!(process.env.ARGOS_RUN_INTEGRATION && process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS);
const maybeDescribe = dbAvailable ? describe : describe.skip;

maybeDescribe("DiscordTokenManager integration", () => {
    const testId = "123456789012345678";

    beforeAll(async () => {
        await setupTestDb();
        process.env.DISCORD_ID = "test_client_id";
        process.env.DISCORD_SECRET = "test_secret";
        process.env.DISCORD_OAUTH = "https://example.com/callback";
    });

    afterAll(async () => {
        await teardownTestDb();
    });

    beforeEach(async () => {
        await clearAllTables();
    });

    it("discordOauthExchange() writes tokens to discordToken table (not literal '$1')", async () => {
        // regression: saveTokens used $1 instead of ? for MariaDB
        await discordOauthExchange("test_code");
        const rows = await dbQuery("SELECT * FROM discordToken WHERE id = ?", [testId]);
        expect(rows.length).toBe(1);
        expect(rows[0].access_token).toBe("new_token");
        expect(rows[0].id).toBe(testId); // row stored by user.id, not by code
    });

    it("getToken() retrieves saved row by exact discord_id", async () => {
        // Insert a non-expired token
        const expiresAt = Date.now() + 3600000;
        await dbQuery(
            "REPLACE INTO discordToken (id, access_token, expires_in, expires_at, refresh_token, scope, token_type) VALUES (?,?,?,?,?,?,?)",
            [testId, "valid_token", 3600, expiresAt, "ref", "identify", "Bearer"]
        );
        const token = await getToken(testId);
        expect(token).toBe("Bearer valid_token");
    });

    it("getToken() returns 'TokenType AccessToken' format string", async () => {
        const expiresAt = Date.now() + 3600000;
        await dbQuery(
            "REPLACE INTO discordToken (id, access_token, expires_in, expires_at, refresh_token, scope, token_type) VALUES (?,?,?,?,?,?,?)",
            [testId, "acc123", 3600, expiresAt, "ref", "identify", "Bearer"]
        );
        const result = await getToken(testId);
        expect(result).toMatch(/^Bearer /);
    });

    it("getToken() rejects with USER_NOT_IN_DB for unknown id", async () => {
        // regression: WHERE id='$1' literal bug would fail to find any row
        await expect(getToken("nonexistent_user_id")).rejects.toThrow("USER_NOT_IN_DB");
    });

    it("getToken() refreshes expired token via Discord API (mock axios)", async () => {
        const expiredAt = Date.now() - 1000;
        await dbQuery(
            "REPLACE INTO discordToken (id, access_token, expires_in, expires_at, refresh_token, scope, token_type) VALUES (?,?,?,?,?,?,?)",
            [testId, "old_token", 3600, expiredAt, "old_refresh", "identify", "Bearer"]
        );
        const result = await getToken(testId);
        expect(mockPost).toHaveBeenCalled();
        expect(result).toContain("new_token");
    });

    it("getToken() saves refreshed token back to DB", async () => {
        const expiredAt = Date.now() - 1000;
        await dbQuery(
            "REPLACE INTO discordToken (id, access_token, expires_in, expires_at, refresh_token, scope, token_type) VALUES (?,?,?,?,?,?,?)",
            [testId, "old_token", 3600, expiredAt, "old_refresh", "identify", "Bearer"]
        );
        await getToken(testId);
        // Small wait for fire-and-forget saveTokens
        await new Promise(r => setTimeout(r, 50));
        const rows = await dbQuery("SELECT access_token FROM discordToken WHERE id = ?", [testId]);
        expect(rows[0].access_token).toBe("new_token");
    });

    it("discordOauthExchange() saves tokens keyed by user.id not code", async () => {
        await discordOauthExchange("some_oauth_code");
        const rows = await dbQuery("SELECT id FROM discordToken WHERE id = ?", [testId]);
        expect(rows.length).toBe(1);
        expect(rows[0].id).toBe(testId);
    });
});
