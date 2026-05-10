import { describe, it, expect, mock } from "bun:test";
import { makeButton } from "../../__fixtures__/discordInteractions";
import Delete from "../../bot/commands/Delete";

describe("Delete command", () => {
    const cmd = new Delete();

    it("button() defers update then deletes message when owner matches", async () => {
        const userId = "123456789012345678";
        const interaction = makeButton(`delete-${userId}`);
        await cmd.button(interaction);
        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.message.delete).toHaveBeenCalled();
    });

    it("button() ignores if customId owner != caller", async () => {
        const interaction = makeButton("delete-999999999999999999", {
            user: { id: "123456789012345678" }
        });
        await cmd.button(interaction);
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(interaction.message.delete).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalled();
    });
});
