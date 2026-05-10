import DiscordCommand from "../../structs/DiscordCommand";
import { ChatInputCommandInteraction } from "discord.js";
import { dbQuery } from "../../automata/Database";

export default class Xur extends DiscordCommand {
    constructor() {
        super("xur", { name: "xur", description: "Check where Xûr is and what he's selling." });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const rows = await dbQuery("SELECT value FROM misc WHERE key_name = 'xurEmbed'");
        if (rows.length > 0 && rows[0].value) {
            interaction.reply({ embeds: [JSON.parse(rows[0].value)] });
        } else {
            interaction.reply({ content: "Xur doesn't seem to be on any planet." });
        }
    }
}
