import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
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
import { makeChatInput } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

describe("D2Stats command", () => {
    const cmd = new D2Stats();
    const userId = "123456789012345678";

    beforeEach(() => {
        mockDbQuery.mockClear();
        mockUpdateStats.mockClear();
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
});
