import DiscordCommand from "../../structs/DiscordCommand";
import { ButtonInteraction, MessageFlags } from "discord.js";

export default class Delete extends DiscordCommand {
    constructor() {
        super("delete");
    }

    async button(interaction: ButtonInteraction) {
        if (interaction.customId.split("-")[1] === interaction.user.id) {
            await interaction.deferUpdate();
            interaction.message.delete().catch(e => console.log(e));
        } else {
            interaction.reply({ content: "This isn't your command.", flags: MessageFlags.Ephemeral })
                .catch(e => console.log(e));
        }
    }
}
