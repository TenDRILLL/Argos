import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

import Leaderboard from "../../bot/commands/Leaderboard";
import { makeChatInput, makeAutocomplete } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

describe("Leaderboard command", () => {
    const cmd = new Leaderboard();
    const userId = "123456789012345678";

    beforeEach(() => mockDbQuery.mockClear());

    it("chatInput() rejects invalid leaderboard value", async () => {
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getString: mock((key: string, required: boolean) => key === "leaderboard" ? "invalid_value" : null),
                getSubcommand: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: "Invalid leaderboard." })
        );
    });

    it("chatInput() fetches kd from users table", async () => {
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getString: mock((key: string) => key === "leaderboard" ? "kd" : null),
                getSubcommand: mock(() => null),
                getUser: mock(() => null)
            }
        });
        mockDbQuery.mockResolvedValueOnce([
            { discord_id: userId, destiny_name: "Guardian#1234", stats_kd: 1.5 }
        ]);
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("stats_kd"));
        expect(call).toBeDefined();
    });

    it("chatInput() fetches activity clears via JOIN for activity boards", async () => {
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getString: mock((key: string) => key === "leaderboard" ? "r-Last Wish" : null),
                getSubcommand: mock(() => null),
                getUser: mock(() => null)
            }
        });
        mockDbQuery.mockResolvedValueOnce([
            { discord_id: userId, destiny_name: "Guardian#1234", clears: 10 }
        ]);
        await cmd.chatInput(interaction);
        const call = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("JOIN"));
        expect(call).toBeDefined();
    });

    it("chatInput() renders top 3 with medal emojis", async () => {
        mockDbQuery.mockResolvedValueOnce([
            { discord_id: "u1", destiny_name: "Alpha#0001", stats_kd: 3.0 },
            { discord_id: "u2", destiny_name: "Beta#0002", stats_kd: 2.0 },
            { discord_id: "u3", destiny_name: "Gamma#0003", stats_kd: 1.0 }
        ]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getString: mock((key: string) => key === "leaderboard" ? "kd" : null),
                getSubcommand: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        const embed = interaction.editReply.mock.calls[0][0].embeds[0];
        const top3Field = embed.data.fields[0];
        expect(top3Field.value).toContain("<:first:");
        expect(top3Field.value).toContain("<:second:");
        expect(top3Field.value).toContain("<:third:");
    });

    it("chatInput() bolds the requesting user's entry", async () => {
        mockDbQuery.mockResolvedValueOnce([
            { discord_id: userId, destiny_name: "Guardian#1234", stats_kd: 2.5 }
        ]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getString: mock((key: string) => key === "leaderboard" ? "kd" : null),
                getSubcommand: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        const embed = interaction.editReply.mock.calls[0][0].embeds[0];
        const top3 = embed.data.fields[0].value;
        expect(top3).toContain("**");
    });

    describe("autocomplete()", () => {
        it("filters options by prefix (case-insensitive)", () => {
            const interaction = makeAutocomplete("total");
            cmd.autocomplete(interaction);
            const results = interaction.respond.mock.calls[0][0];
            results.forEach((r: any) => {
                expect(r.name.toLowerCase()).toContain("total");
            });
        });

        it("limits to 25 results", () => {
            const interaction = makeAutocomplete("");
            cmd.autocomplete(interaction);
            const results = interaction.respond.mock.calls[0][0];
            expect(results.length).toBeLessThanOrEqual(25);
        });
    });
});
