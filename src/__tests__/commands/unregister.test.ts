import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockGetToken = mock(() => Promise.resolve("Bearer discord_token"));

mock.module("../../automata/DiscordTokenManager", () => ({
    getToken: mockGetToken,
    discordOauthExchange: mock(() => Promise.resolve({})),
    getDiscordInformation: mock(() => Promise.resolve({}))
}));

const mockAxiosPut = mock(() => Promise.resolve({ data: {} }));

mock.module("axios", () => ({
    default: { put: mockAxiosPut, get: mock(() => Promise.resolve()), post: mock(() => Promise.resolve()) },
    put: mockAxiosPut
}));

import Unregister from "../../bot/commands/Unregister";
import { makeChatInput } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

describe("Unregister command", () => {
    const cmd = new Unregister();
    const userId = "123456789012345678";

    function makeInteraction(guildMember?: any) {
        const guild = guildMember
            ? { members: { fetch: mock(() => Promise.resolve(guildMember)) } }
            : null;
        return makeChatInput({
            user: { id: userId },
            client: { guilds: { cache: { get: mock(() => guild) } } }
        });
    }

    beforeEach(() => {
        mockDbQuery.mockClear();
        mockGetToken.mockClear();
        process.env.DISCORD_ID = "test_app_id";
    });

    it("chatInput() deletes from user_activities", async () => {
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM user_activities"));
        expect(call).toBeDefined();
        expect(call![1]).toContain(userId);
    });

    it("chatInput() deletes from user_tokens", async () => {
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM user_tokens"));
        expect(call).toBeDefined();
    });

    it("chatInput() deletes from discordToken — regression: missing discordToken cleanup (bot)", async () => {
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM discordToken"));
        expect(call).toBeDefined();
        expect(call![1]).toContain(userId);
    });

    it("chatInput() deletes from users", async () => {
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM users"));
        expect(call).toBeDefined();
    });

    it("chatInput() replies 'Unregistered.' ephemerally", async () => {
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: "Unregistered." })
        );
    });

    it("chatInput() proceeds even when getToken fails (no token)", async () => {
        mockGetToken.mockRejectedValueOnce(new Error("no token"));
        const interaction = makeInteraction();
        await cmd.chatInput(interaction);
        // Still deletes from all tables
        const deleteCalls = mockDbQuery.mock.calls.filter((c: any[]) => c[0].includes("DELETE FROM"));
        expect(deleteCalls.length).toBe(4);
    });
});
