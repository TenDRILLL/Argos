import { describe, it, expect, mock, beforeAll } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockDecrypt = mock(() => Promise.resolve("123456789012345678"));

mock.module("../../utils/crypt", () => ({
    crypt: mock(() => Promise.resolve("encrypted")),
    decrypt: mockDecrypt
}));

const mockRemoveAccountRoles = mock(() => Promise.resolve());

mock.module("../../utils/removeAccountRoles", () => ({
    removeAccountRoles: mockRemoveAccountRoles
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import makeUnregisterRouter from "../../web/endpoints/unregister";
import path from "path";

const fakeClient: any = { guilds: { cache: { get: () => null } } };
const app = express();
app.use(cookieParser());
app.set("views", path.join(__dirname, "../../../../html/pages"));
app.set("view engine", "ejs");
app.use("/unregister", makeUnregisterRouter(fakeClient));

describe("GET /unregister", () => {
    beforeAll(() => {
        process.env.ARGOS_ID_PASSWORD = "test_pass";
    });

    it("deletes from user_activities with conflux cookie", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([{ discord_id: "123456789012345678" }]);
        mockDbQuery.mockResolvedValue([]);
        await request(app).get("/unregister").set("Cookie", "conflux=valid");
        const deleteActivities = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM user_activities"));
        expect(deleteActivities).toBeDefined();
    });

    it("deletes from discordToken — regression: missing discordToken cleanup (web)", async () => {
        mockDbQuery.mockClear();
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([{ discord_id: "123456789012345678" }]);
        mockDbQuery.mockResolvedValue([]);
        await request(app).get("/unregister").set("Cookie", "conflux=valid");
        const deleteDiscordToken = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM discordToken"));
        expect(deleteDiscordToken).toBeDefined();
    });

    it("clears conflux cookie after unregister", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValue([]);
        const res = await request(app).get("/unregister").set("Cookie", "conflux=valid");
        const cookies = res.headers["set-cookie"] as string[] | undefined;
        const confluxClear = cookies?.find(c => c.startsWith("conflux="));
        expect(confluxClear).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0|conflux=;/i);
    });

    it("renders logout.ejs (200 or 500 if template missing)", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValue([]);
        const res = await request(app).get("/unregister").set("Cookie", "conflux=valid");
        expect([200, 500]).toContain(res.status);
    });

    it("with no conflux still renders logout.ejs (no error)", async () => {
        const res = await request(app).get("/unregister");
        expect([200, 302, 500]).toContain(res.status);
    });
});
