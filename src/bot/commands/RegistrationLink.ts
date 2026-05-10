import DiscordCommand from "../../structs/DiscordCommand";
import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";

export default class RegistrationLink extends DiscordCommand {
    constructor() {
        super("registrationlink", { name: "registrationlink", description: "Post the registration link." });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        await interaction.reply({ content: "Sent.", flags: MessageFlags.Ephemeral });
        await (interaction.channel as any)?.send({
            content: "**To unlock Destiny channels and roles, register here.**",
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel("Register")
                        .setStyle(ButtonStyle.Link)
                        .setURL(process.env.REGISTER_URL!)
                )
            ]
        }).catch(e => console.log(e));
    }
}
