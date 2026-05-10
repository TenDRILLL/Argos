import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockGetAdminBungieToken = mock(() => Promise.resolve("admin_access_token"));

mock.module("../../automata/UserService", () => ({
    userService: { getAdminBungieToken: mockGetAdminBungieToken }
}));

const mockApiRequest = mock(() => Promise.resolve({
    Response: {
        displayName: "Guardian",
        cachedBungieGlobalDisplayName: "Guardian",
        cachedBungieGlobalDisplayNameCode: 1234
    },
    ErrorCode: 1,
    ThrottleSeconds: 0
}));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest }
}));

import ClanRequest from "../../bot/commands/ClanRequest";
import { makeButton } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

describe("ClanRequest command", () => {
    const cmd = new ClanRequest();
    const adminId = "admin_user_id";

    beforeEach(() => {
        mockDbQuery.mockClear();
        mockGetAdminBungieToken.mockClear();
        mockApiRequest.mockClear();
        process.env.ADMIN_USER_ID = adminId;
        process.env.BUNGIE_CLAN_ID = "test_clan_id";
    });

    it("button() replies 'Token refresh failed' when getAdminBungieToken throws", async () => {
        mockGetAdminBungieToken.mockRejectedValueOnce(new Error("Admin not registered"));
        const interaction = makeButton("clanrequest-approve-bungie123-destiny456-3");
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Token refresh failed") })
        );
    });

    it("button() approve — calls approveClanMember endpoint", async () => {
        const approveResp = { Response: {}, ErrorCode: 1, ThrottleSeconds: 0 };
        mockApiRequest
            .mockResolvedValueOnce({ Response: { displayName: "G", cachedBungieGlobalDisplayName: "G", cachedBungieGlobalDisplayNameCode: 1234 }, ThrottleSeconds: 0, ErrorCode: 1 })
            .mockResolvedValueOnce(approveResp);
        mockDbQuery.mockResolvedValueOnce([{ value: '[]' }]);
        const interaction = makeButton("clanrequest-approve-bungie123-destiny456-3");
        await cmd.button(interaction);
        const approveCall = mockApiRequest.mock.calls.find((c: any[]) => c[0] === "approveClanMember");
        expect(approveCall).toBeDefined();
    });

    it("button() deny — calls denyClanMember endpoint", async () => {
        const denyResp = { Response: {}, ErrorCode: 1, ThrottleSeconds: 0 };
        mockApiRequest
            .mockResolvedValueOnce({ Response: { displayName: "G", cachedBungieGlobalDisplayName: "G", cachedBungieGlobalDisplayNameCode: 1234 }, ThrottleSeconds: 0, ErrorCode: 1 })
            .mockResolvedValueOnce(denyResp);
        mockDbQuery.mockResolvedValueOnce([{ value: '[]' }]);
        const interaction = makeButton("clanrequest-deny-bungie123-destiny456-3");
        await cmd.button(interaction);
        const denyCall = mockApiRequest.mock.calls.find((c: any[]) => c[0] === "denyClanMember");
        expect(denyCall).toBeDefined();
    });

    it("button() unknown action — replies invalid action", async () => {
        mockApiRequest.mockResolvedValueOnce({ Response: { displayName: "G", cachedBungieGlobalDisplayName: "G", cachedBungieGlobalDisplayNameCode: 1234 }, ThrottleSeconds: 0, ErrorCode: 1 });
        const interaction = makeButton("clanrequest-unknown-bungie123-destiny456-3");
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("not a valid action") })
        );
    });

    it("button() uses BUNGIE_CLAN_ID env var, not hardcoded", async () => {
        process.env.BUNGIE_CLAN_ID = "env_clan_id_12345";
        const approveResp = { Response: {}, ErrorCode: 1, ThrottleSeconds: 0 };
        mockApiRequest
            .mockResolvedValueOnce({ Response: { displayName: "G", cachedBungieGlobalDisplayName: "G", cachedBungieGlobalDisplayNameCode: 1234 }, ThrottleSeconds: 0, ErrorCode: 1 })
            .mockResolvedValueOnce(approveResp);
        mockDbQuery.mockResolvedValueOnce([{ value: '[]' }]);
        const interaction = makeButton("clanrequest-approve-bungie123-destiny456-3");
        await cmd.button(interaction);
        const clanCall = mockApiRequest.mock.calls.find((c: any[]) => c[0] === "approveClanMember");
        expect(clanCall![1].groupId).toBe("env_clan_id_12345");
    });

    it("deleteData() replies confirmed on ErrorCode 1 and deletes message", async () => {
        mockApiRequest
            .mockResolvedValueOnce({ Response: { displayName: "G", cachedBungieGlobalDisplayName: "G", cachedBungieGlobalDisplayNameCode: 1234 }, ThrottleSeconds: 0, ErrorCode: 1 })
            .mockResolvedValueOnce({ ErrorCode: 1, ThrottleSeconds: 0 });
        mockDbQuery.mockResolvedValueOnce([{ value: '["destiny456"]' }]);
        const interaction = makeButton("clanrequest-approve-bungie123-destiny456-3");
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Application") })
        );
        expect(interaction.message.delete).toHaveBeenCalled();
    });
});
