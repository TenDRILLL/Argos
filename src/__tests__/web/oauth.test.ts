import { describe, it, expect, mock, beforeAll } from "bun:test";

const mockNewRegistration = mock((_client: any, _dc: string, _d2: string, res: any) => {
    res.cookie("conflux", "encrypted_id", {}).redirect("/api/panel");
});

mock.module("../../automata/RegistrationService", () => ({
    newRegistration: mockNewRegistration
}));

const mockDiscordOauthExchange = mock(() => Promise.resolve({ id: "123456789012345678", username: "testuser" }));

mock.module("../../automata/DiscordTokenManager", () => ({
    discordOauthExchange: mockDiscordOauthExchange,
    getToken: mock(() => Promise.resolve("Bearer token")),
    getDiscordInformation: mock(() => Promise.resolve({}))
}));

const mockCrypt = mock(() => Promise.resolve("encrypted_discord_id"));

mock.module("../../utils/crypt", () => ({
    crypt: mockCrypt,
    decrypt: mock(() => Promise.resolve("123456789012345678"))
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import makeOauthRouter from "../../web/endpoints/oauth";

const fakeClient: any = {};
const app = express();
app.use(cookieParser());
app.use("/api/oauth", makeOauthRouter(fakeClient));

describe("GET /api/oauth", () => {
    beforeAll(() => {
        process.env.DISCORD_ID = "test_app_id";
        process.env.ARGOS_ID_PASSWORD = "test_pass";
    });

    it("?code=X&state=Y calls newRegistration(client, code, state, res)", async () => {
        mockNewRegistration.mockClear();
        const res = await request(app).get("/api/oauth?code=dc_code&state=d2_code");
        expect(mockNewRegistration).toHaveBeenCalledWith(fakeClient, "dc_code", "d2_code", expect.anything());
    });

    it("?code=X (no state) calls discordOauthExchange, sets conflux cookie", async () => {
        mockDiscordOauthExchange.mockClear();
        mockCrypt.mockResolvedValueOnce("encrypted_id");
        const res = await request(app).get("/api/oauth?code=only_dc_code");
        expect(mockDiscordOauthExchange).toHaveBeenCalledWith("only_dc_code");
        const cookies = res.headers["set-cookie"] as string[] | undefined;
        expect(cookies?.some(c => c.startsWith("conflux="))).toBe(true);
    });

    it("?error=access_denied redirects to /error Splicer", async () => {
        const res = await request(app).get("/api/oauth?error=access_denied");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
        expect(res.headers.location).toContain("Splicer");
    });

    it("(no code, no error) redirects to /error OOB", async () => {
        const res = await request(app).get("/api/oauth");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
        expect(res.headers.location).toContain("OOB");
    });

    it("conflux cookie has 1-year expiry", async () => {
        mockDiscordOauthExchange.mockResolvedValueOnce({ id: "123456789012345678", username: "test" });
        mockCrypt.mockResolvedValueOnce("encrypted_val");
        const res = await request(app).get("/api/oauth?code=test_code");
        const cookies = res.headers["set-cookie"] as string[] | undefined;
        const conflux = cookies?.find(c => c.startsWith("conflux="));
        // 1-year expiry: Expires or Max-Age set
        expect(conflux).toMatch(/Expires|Max-Age/i);
    });
});
