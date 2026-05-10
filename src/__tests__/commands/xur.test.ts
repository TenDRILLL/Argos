import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

import { makeChatInput } from "../../__fixtures__/discordInteractions";
import Xur from "../../bot/commands/Xur";

describe("Xur command", () => {
    const cmd = new Xur();

    beforeEach(() => mockDbQuery.mockClear());

    it("chatInput() replies with embed from misc table", async () => {
        const fakeEmbed = { title: "Xûr", description: "At EDZ" };
        mockDbQuery.mockResolvedValueOnce([{ value: JSON.stringify(fakeEmbed) }]);
        const interaction = makeChatInput();
        await cmd.chatInput(interaction);
        const args = interaction.reply.mock.calls[0][0];
        expect(args.embeds).toBeDefined();
        expect(args.embeds[0]).toEqual(fakeEmbed);
    });

    it("chatInput() replies 'not on any planet' when no misc row", async () => {
        mockDbQuery.mockResolvedValueOnce([]);
        const interaction = makeChatInput();
        await cmd.chatInput(interaction);
        const args = interaction.reply.mock.calls[0][0];
        expect(args.content).toContain("on any planet");
    });

    it("chatInput() parses stored JSON correctly", async () => {
        const embed = { title: "Xûr", fields: [{ name: "Location", value: "Tower" }] };
        mockDbQuery.mockResolvedValueOnce([{ value: JSON.stringify(embed) }]);
        const interaction = makeChatInput();
        await cmd.chatInput(interaction);
        const args = interaction.reply.mock.calls[0][0];
        expect(args.embeds[0].title).toBe("Xûr");
    });
});
