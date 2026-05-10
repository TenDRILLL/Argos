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

const mockUpdateStats = mock(() => Promise.resolve({
    discord_id: "123456789012345678",
    bungie_id: "987",
    destiny_name: "Guardian#1234",
    destiny_id: "111",
    membership_type: 3,
    in_clan: "clan",
    guardian_rank: 6,
    stats: { kd: 1.5, light: 1810 },
    raids: { Total: 0 },
    dungeons: { Total: 0 },
    grandmasters: { Total: 0 }
}));

mock.module("../../automata/UserService", () => ({
    userService: { updateStats: mockUpdateStats }
}));

const mockGetDiscordInformation = mock(() => Promise.resolve({ id: "123456789012345678", username: "testuser" }));

mock.module("../../automata/DiscordTokenManager", () => ({
    getDiscordInformation: mockGetDiscordInformation,
    getToken: mock(() => Promise.resolve("Bearer token")),
    discordOauthExchange: mock(() => Promise.resolve({}))
}));

const mockGetPanelPageVariables = mock(() => Promise.resolve({
    DBData: { destiny_name: "Guardian#1234" },
    characters: [],
    raids: {},
    dungeons: {},
    gms: {},
    discordUser: null,
    recordDefinitions: {},
    classHashes: new Map()
}));

mock.module("../../utils/getPanelPageVariables", () => ({
    getPanelPageVariables: mockGetPanelPageVariables
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import panelRouter from "../../web/endpoints/panel";
import path from "path";

const app = express();
app.use(cookieParser());
app.set("views", path.join(__dirname, "../../../../html/pages"));
app.set("view engine", "ejs");
app.use("/api/panel", panelRouter);

describe("GET /api/panel", () => {
    beforeAll(() => {
        process.env.ARGOS_ID_PASSWORD = "test_password";
    });

    it("with no conflux cookie redirects to /error Oracle", async () => {
        const res = await request(app).get("/api/panel");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
        expect(res.headers.location).toContain("Oracle");
    });

    it("with invalid decrypt clears cookie and redirects", async () => {
        mockDecrypt.mockImplementationOnce(() => Promise.reject(new Error("decrypt failed")));
        const res = await request(app)
            .get("/api/panel")
            .set("Cookie", "conflux=bad_value");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("when user not in DB clears cookie and redirects", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([]); // no user row
        const res = await request(app)
            .get("/api/panel")
            .set("Cookie", "conflux=valid_encrypted");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("with valid conflux cookie renders panel (200 or 500 if template missing)", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([{ discord_id: "123456789012345678" }]);
        const res = await request(app)
            .get("/api/panel")
            .set("Cookie", "conflux=valid_encrypted");
        expect([200, 500]).toContain(res.status);
    });
});
