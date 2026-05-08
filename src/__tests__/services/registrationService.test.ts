import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockDiscordOauthExchange = mock(() => Promise.resolve({ id: "123456789012345678", username: "testuser" }));

mock.module("../../automata/DiscordTokenManager", () => ({
    discordOauthExchange: mockDiscordOauthExchange,
    getToken: mock(() => Promise.resolve("Bearer token")),
    getDiscordInformation: mock(() => Promise.resolve({}))
}));

const mockBungieToken = mock(() => Promise.resolve({
    access_token: "bungie_access",
    expires_in: 3600,
    refresh_token: "bungie_refresh",
    refresh_expires_in: 7776000,
    membership_id: "987654321098765432"
}));
const mockBungieApiRequest = mock(() => Promise.resolve({
    Response: {
        uniqueName: "Guardian#1234",
        steamDisplayName: "Guardian",
        cachedBungieGlobalDisplayName: "Guardian",
        cachedBungieGlobalDisplayNameCode: 1234,
        profiles: [{ membershipId: "111222333444555666", membershipType: 3, isCrossSavePrimary: true }]
    },
    ThrottleSeconds: 0,
    ErrorCode: 1
}));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { token: mockBungieToken, apiRequest: mockBungieApiRequest }
}));

const mockCrypt = mock(() => Promise.resolve("encrypted_discord_id"));

mock.module("../../utils/crypt", () => ({
    crypt: mockCrypt,
    decrypt: mock(() => Promise.resolve("123456789012345678"))
}));

const mockRemoveAccountRoles = mock(() => {});

mock.module("../../utils/removeAccountRoles", () => ({
    removeAccountRoles: mockRemoveAccountRoles
}));

const mockUpdateUserRoles = mock(() => Promise.resolve());

mock.module("../../automata/UserService", () => ({
    userService: { updateUserRoles: mockUpdateUserRoles }
}));

import { newRegistration } from "../../automata/RegistrationService";

function makeFakeRes() {
    const res: any = {
        cookies: {} as any,
        redirectTarget: "",
        cookie: mock(function(name: string, val: string, opts: any) { this.cookies[name] = val; return this; }),
        redirect: mock(function(url: string) { this.redirectTarget = url; return this; }),
        render: mock(() => {})
    };
    return res;
}

describe("newRegistration()", () => {
    let fakeClient: any;
    let fakeRes: any;

    beforeEach(() => {
        fakeClient = {
            guilds: { cache: { get: mock(() => ({ members: { fetch: mock(() => Promise.resolve({ roles: { cache: { has: () => false, keys: () => [] }, set: mock(() => Promise.resolve()) } })) } })) }
        };
        fakeRes = makeFakeRes();
        mockDbQuery.mockClear();
        mockDiscordOauthExchange.mockClear();
        mockBungieToken.mockClear();
        mockBungieApiRequest.mockClear();
        mockCrypt.mockClear();
        process.env.BUNGIE_CLIENT_ID = "test_client";
        process.env.BUNGIE_SECRET = "test_secret";
        process.env.ARGOS_ID_PASSWORD = "argos_id_pass";
    });

    it("calls discordOauthExchange with dccode", async () => {
        mockDbQuery.mockResolvedValue([]);
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 50));
        expect(mockDiscordOauthExchange).toHaveBeenCalledWith("dc_code");
    });

    it("calls bungieAPI.token with Bungie code", async () => {
        mockDbQuery.mockResolvedValue([]);
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 50));
        expect(mockBungieToken).toHaveBeenCalled();
    });

    it("deletes existing user when same Bungie ID registered to different Discord", async () => {
        mockDbQuery
            .mockResolvedValueOnce([{ discord_id: "other_user_id" }]) // existingUsers
            .mockResolvedValue([]);
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 100));
        const deleteCalls = mockDbQuery.mock.calls.filter((c: any[]) => c[0].includes("DELETE"));
        expect(deleteCalls.length).toBeGreaterThan(0);
    });

    it("REPLACE INTOs users + user_tokens on success (cross-save primary)", async () => {
        mockDbQuery.mockResolvedValue([]);
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 100));
        const replaceCalls = mockDbQuery.mock.calls.filter((c: any[]) => c[0].includes("REPLACE INTO"));
        expect(replaceCalls.some((c: any[]) => c[0].includes("users"))).toBe(true);
        expect(replaceCalls.some((c: any[]) => c[0].includes("user_tokens"))).toBe(true);
    });

    it("sets conflux cookie and redirects to /api/panel", async () => {
        mockDbQuery.mockResolvedValue([]);
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 100));
        expect(fakeRes.cookies["conflux"]).toBe("encrypted_discord_id");
        expect(fakeRes.redirectTarget).toBe("/api/panel");
    });

    it("redirects to /error on Discord OAuth failure", async () => {
        mockDiscordOauthExchange.mockRejectedValueOnce(new Error("discord_failed"));
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 50));
        expect(fakeRes.redirectTarget).toContain("/error");
    });

    it("redirects to /error on Bungie token failure", async () => {
        mockBungieToken.mockRejectedValueOnce(new Error("bungie_failed"));
        newRegistration(fakeClient, "dc_code", "d2_code", fakeRes);
        await new Promise(r => setTimeout(r, 50));
        expect(fakeRes.redirectTarget).toContain("/error");
    });
});
