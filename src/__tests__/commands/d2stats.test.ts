import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockGetProgress = mock(() => Promise.resolve(new Map([
    ["Rufus's Fury", { progress: 5, completionValue: 5 }],
    ["Age-Old Bond", { progress: 3, completionValue: 5 }],
])));

const mockPatternService = {
    getProgress: mockGetProgress,
    hashCount: 55,
    init: mock(() => Promise.resolve()),
};

mock.module("../../automata/PatternService", () => ({
    patternService: mockPatternService,
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
    raids: { Total: 50, "Last Wish": 10, "Vault of Glass": 5, "Vault of Glass, Master": 2 },
    dungeons: { Total: 20, "Pit of Heresy": 5 },
    grandmasters: { Total: 15, "The Glassway": 3 }
}));

mock.module("../../automata/UserService", () => ({
    userService: { updateStats: mockUpdateStats }
}));

import D2Stats from "../../bot/commands/D2Stats";
import { makeChatInput, makeAutocomplete } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

describe("D2Stats command", () => {
    const cmd = new D2Stats();
    const userId = "123456789012345678";

    beforeEach(() => {
        mockDbQuery.mockClear();
        mockUpdateStats.mockClear();
        mockGetProgress.mockClear();
        mockPatternService.hashCount = 55;
    });

    it("chatInput() replies 'not registered' when user not in DB", async () => {
        mockDbQuery.mockResolvedValueOnce([]);
        const interaction = makeChatInput({ user: { id: userId } });
        await cmd.chatInput(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("not registered") })
        );
    });

    it("chatInput() calls deferReply then updateStats when user found", async () => {
        mockDbQuery.mockResolvedValueOnce([{ discord_id: userId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "summary"),
                getString: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(mockUpdateStats).toHaveBeenCalledWith(userId);
    });

    it("chatInput() routes to summary() for subcommand 'summary'", async () => {
        mockDbQuery.mockResolvedValueOnce([{ discord_id: userId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "summary"),
                getString: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        const replyArg = interaction.editReply.mock.calls[0]?.[0];
        expect(replyArg?.embeds).toBeDefined();
        // Summary embed has title including destiny_name
        expect(replyArg.embeds[0].data?.title).toContain("Guardian#1234");
    });

    it("chatInput() editReplies 'Not implemented yet.' for unknown subcommand", async () => {
        mockDbQuery.mockResolvedValueOnce([{ discord_id: userId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "unknown_subcommand"),
                getString: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: "Not implemented yet." })
        );
    });

    it("summary() embed contains destiny_name, kd, light, raids total, dungeons total, GMs total", async () => {
        mockDbQuery.mockResolvedValueOnce([{ discord_id: userId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "summary"),
                getString: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        const embed = interaction.editReply.mock.calls[0][0].embeds[0];
        const fields = embed.data.fields;
        const fieldValues = fields.map((f: any) => f.value);
        expect(fieldValues).toContain("1810");   // light
        expect(fieldValues).toContain("50");      // raids total
        expect(fieldValues).toContain("20");      // dungeons total
        expect(fieldValues).toContain("15");      // GMs total
    });

    it("sendEmbed() includes Delete button with delete-{authorId} customId", async () => {
        mockDbQuery.mockResolvedValueOnce([{ discord_id: userId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "raids"),
                getString: mock(() => null),
                getUser: mock(() => null)
            }
        });
        await cmd.chatInput(interaction);
        const components = interaction.editReply.mock.calls[0][0].components;
        const buttons = components[0].components;
        const deleteBtn = buttons.find((b: any) => b.data.custom_id === `delete-${userId}`);
        expect(deleteBtn).toBeDefined();
    });

    it("chatInput() fetches target user stats when 'user' option provided", async () => {
        const targetId = "999888777666555444";
        mockDbQuery.mockResolvedValueOnce([{ discord_id: targetId }]);
        const interaction = makeChatInput({
            user: { id: userId },
            options: {
                getSubcommand: mock(() => "summary"),
                getString: mock(() => null),
                getUser: mock(() => ({ id: targetId }))
            }
        });
        await cmd.chatInput(interaction);
        expect(mockUpdateStats).toHaveBeenCalledWith(targetId);
    });

    describe("patterns subcommand", () => {
        const destinyUser = { destiny_id: "111222333", membership_type: 3, destiny_name: "Raider#9999" };

        function makePatternsInteraction(raidFilter: string | null = null) {
            return makeChatInput({
                user: { id: userId },
                options: {
                    getSubcommand: mock(() => "patterns"),
                    getString: mock((name: string) => name === "raid" ? raidFilter : null),
                    getUser: mock(() => null),
                }
            });
        }

        it("editReplies when no destiny account linked", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([{ destiny_id: null }]);
            const interaction = makePatternsInteraction();
            await cmd.chatInput(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: "No Destiny account linked for this user." })
            );
        });

        it("editReplies when getProgress throws", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            mockGetProgress.mockRejectedValueOnce(new Error("API down"));
            const interaction = makePatternsInteraction();
            await cmd.chatInput(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: "Failed to fetch pattern data from Bungie API." })
            );
        });

        it("editReplies when hashCount is 0", async () => {
            mockPatternService.hashCount = 0;
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction();
            await cmd.chatInput(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("Pattern hash lookup failed") })
            );
        });

        it("editReplies for unknown raid filter", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Not A Real Raid");
            await cmd.chatInput(interaction);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({ content: "Unknown raid name." })
            );
        });

        it("total embed has 9 fields (one per raid)", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.fields).toHaveLength(9);
        });

        it("total embed description contains grand total out of 275", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.description).toContain("/ 275");
        });

        it("total embed title is 'Raid Weapon Patterns'", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.title).toBe("Raid Weapon Patterns");
        });

        it("per-raid embed title contains the raid name", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Root of Nightmares");
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.title).toContain("Root of Nightmares");
        });

        it("per-raid embed has 6 fields for Root of Nightmares", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Root of Nightmares");
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.fields).toHaveLength(6);
        });

        it("per-raid embed has 7 fields for Garden of Salvation", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Garden of Salvation");
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.fields).toHaveLength(7);
        });

        it("total embed fields are inline", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.fields.every((f: any) => f.inline === true)).toBe(true);
        });

        it("per-raid embed fields are inline", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Root of Nightmares");
            await cmd.chatInput(interaction);
            const embed = interaction.editReply.mock.calls[0][0].embeds[0];
            expect(embed.data.fields.every((f: any) => f.inline === true)).toBe(true);
        });

        it("fetches application emojis for total embed", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            expect(interaction.client.application.emojis.fetch).toHaveBeenCalled();
        });

        it("fetches application emojis for per-raid embed", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction("Root of Nightmares");
            await cmd.chatInput(interaction);
            expect(interaction.client.application.emojis.fetch).toHaveBeenCalled();
        });

        it("calls getProgress with correct membershipType and destinyId", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: userId }])
                .mockResolvedValueOnce([destinyUser]);
            const interaction = makePatternsInteraction(null);
            await cmd.chatInput(interaction);
            expect(mockGetProgress).toHaveBeenCalledWith(3, "111222333");
        });
    });

    describe("autocomplete()", () => {
        it("returns all 9 raids when query is empty", async () => {
            const interaction = makeAutocomplete({ name: "raid", value: "" });
            cmd.autocomplete(interaction);
            const choices = interaction.respond.mock.calls[0][0];
            expect(choices).toHaveLength(9);
        });

        it("filters raids by query string", async () => {
            const interaction = makeAutocomplete({ name: "raid", value: "wish" });
            cmd.autocomplete(interaction);
            const choices = interaction.respond.mock.calls[0][0];
            expect(choices).toHaveLength(1);
            expect(choices[0].name).toBe("Last Wish");
        });

        it("returns empty array for non-raid focused option", async () => {
            const interaction = makeAutocomplete({ name: "other", value: "" });
            cmd.autocomplete(interaction);
            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it("choice values equal choice names", async () => {
            const interaction = makeAutocomplete({ name: "raid", value: "Glass" });
            cmd.autocomplete(interaction);
            const choices = interaction.respond.mock.calls[0][0];
            expect(choices.length).toBeGreaterThan(0);
            for (const choice of choices) {
                expect(choice.value).toBe(choice.name);
            }
        });
    });
});
