import DiscordCommand from "../../structs/DiscordCommand";
import {ChatInputCommandInteraction, MessageFlags} from "discord.js";

export default class UpdateActivities extends DiscordCommand {
    constructor() {
        super("updateactivities", { name: "updateactivities", description: "Update the activity identifier database from the Bungie manifest." });
    }

    chatInput(interaction: ChatInputCommandInteraction) {
        interaction.reply({ content: "Not in use.", flags: MessageFlags.Ephemeral });
    }
}
