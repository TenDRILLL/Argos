import { describe, it, expect } from "bun:test";
import { makeChatInput } from "../../__fixtures__/discordInteractions";
import Ping from "../../bot/commands/Ping";
import { MessageFlags } from "discord.js";

describe("Ping command", () => {
    const cmd = new Ping();

    it("chatInput() replies with gateway latency string", () => {
        const interaction = makeChatInput({
            client: { ws: { ping: 42 }, guilds: { cache: { get: () => null } } }
        });
        cmd.chatInput(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: "42ms" })
        );
    });

    it("reply is ephemeral", () => {
        const interaction = makeChatInput({
            client: { ws: { ping: 100 }, guilds: { cache: { get: () => null } } }
        });
        cmd.chatInput(interaction);
        const args = interaction.reply.mock.calls[0][0];
        expect(args.flags).toBe(MessageFlags.Ephemeral);
    });
});
