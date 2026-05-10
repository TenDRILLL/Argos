import DiscordCommand from "../../structs/DiscordCommand";
import {ChatInputCommandInteraction, MessageFlags} from "discord.js";

export default class Ping extends DiscordCommand {
    constructor() {
        super(
            "ping",
            {
                name: "ping",
                description: "Ping."
            }
        );
    }

    chatInput(interaction: ChatInputCommandInteraction) {
        interaction.reply({content: `${interaction.client.ws.ping}ms`, flags: MessageFlags.Ephemeral});
    }
}