import DiscordCommand from "../../structs/DiscordCommand";
import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    AutocompleteInteraction,
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
    ComponentType
} from "discord.js";
import symbol from "../../enums/symbol";

export default class Symbols extends DiscordCommand {
    constructor() {
        super("symbols", {
            name: "symbols",
            description: "Check the locations of symbols in order to gain a Deepsight weapon at the end of the activity.",
            options: [
                { type: ApplicationCommandOptionType.String, name: "activity", description: "Please select the activity from the list below.", required: true, autocomplete: true }
            ]
        });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const symbolId = interaction.options.getString("activity", true);
        const symbolObject = symbol[symbolId];
        if (!symbolObject) {
            return interaction.reply({ content: "Unknown symbol set.", flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor(5064059)
            .setImage(symbolObject.imageURL)
            .setDescription(`${symbolId} Symbols`)
            .setFields([
                { name: "Activate the symbols required to unlock the Deepsight", value: "Click the respective buttons below." }
            ]);

        const symbolButtons: ButtonBuilder[] = [];
        for (let i = 1; i <= symbolObject.symbolCount; i++) {
            symbolButtons.push(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`symbols-${interaction.user.id}-${symbolObject.id}-${i}`)
                    .setLabel(i.toString())
                    .setDisabled(false)
            );
        }

        const actionRows: ActionRowBuilder<ButtonBuilder>[] = [];
        while (symbolButtons.length > 0) {
            actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(symbolButtons.splice(0, 3)));
        }
        actionRows[actionRows.length - 1].addComponents(
            new ButtonBuilder()
                .setCustomId(`symbols-${interaction.user.id}-${symbolObject.id}-confirm`)
                .setLabel("Confirm")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        );
        actionRows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel("Delete")
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`delete-${interaction.user.id}`)
            )
        );

        interaction.reply({ embeds: [embed], components: actionRows });
    }

    async button(interaction: ButtonInteraction) {
        const parts = interaction.customId.split("-");
        const ownerId = parts[1];

        if (ownerId !== interaction.user.id) {
            return interaction.reply({ content: "Please don't touch the buttons of others.", flags: MessageFlags.Ephemeral });
        }

        const symbolId = parts[2];
        const action = parts[3];
        const symbolObject = symbol[symbolId];

        if (action === "confirm") {
            let symbolIDs: string[] = [];
            for (const row of (interaction.message.components as any[])) {
                for (const component of row.components) {
                    if (component.type === ComponentType.Button && "customId" in component && component.style === ButtonStyle.Primary) {
                        const cparts = component.customId!.split("-");
                        const num = cparts[3];
                        if (num !== "confirm") symbolIDs.push(num);
                    }
                }
            }
            if (symbolIDs.length > 10) symbolIDs = symbolIDs.slice(0, 9);

            const embeds: EmbedBuilder[] = symbolIDs.map(num =>
                new EmbedBuilder()
                    .setTitle(`SYMBOL: ${num}`)
                    .setDescription(symbolObject.symbols[num]?.location ?? "###LOCATION###")
                    .setImage(symbolObject.symbols[num]?.imageURL ?? "https://i.imgur.com/PygtZUa.png")
            );

            await interaction.update({
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setLabel("Delete")
                            .setStyle(ButtonStyle.Danger)
                            .setCustomId(`delete-${ownerId}`)
                    )
                ],
                embeds
            });
        } else {
            const clickedNum = parseInt(action);
            const isSelected = parts.length === 5 && parts[4] === "select";

            let selected = 0;
            for (const row of (interaction.message.components as any[])) {
                for (const component of row.components) {
                    if (component.type === ComponentType.Button && "customId" in component) {
                        const cparts = component.customId!.split("-");
                        if (cparts.length === 5 && cparts[4] === "select") selected++;
                    }
                }
            }
            selected = isSelected ? selected - 1 : selected + 1;
            const confirmFilled = selected === symbolObject.required;

            const newRows: ActionRowBuilder<ButtonBuilder>[] = [];
            for (const row of (interaction.message.components as any[])) {
                const newRow = new ActionRowBuilder<ButtonBuilder>();
                for (const component of row.components) {
                    if (component.type !== ComponentType.Button || !("customId" in component)) continue;
                    const cparts = component.customId!.split("-");
                    const btn = new ButtonBuilder().setLabel(component.label ?? "");

                    if (component.customId === `delete-${ownerId}`) {
                        btn.setStyle(ButtonStyle.Danger).setCustomId(component.customId!).setDisabled(false);
                    } else if (cparts[3] === "confirm") {
                        btn.setStyle(ButtonStyle.Primary).setCustomId(component.customId!).setDisabled(!confirmFilled);
                    } else {
                        const btnNum = parseInt(cparts[3]);
                        const wasSelected = cparts.length === 5 && cparts[4] === "select";
                        const nowSelected = btnNum === clickedNum ? !wasSelected : wasSelected;
                        if (nowSelected) {
                            btn.setStyle(ButtonStyle.Primary)
                                .setCustomId(`symbols-${ownerId}-${symbolId}-${btnNum}-select`)
                                .setDisabled(false);
                        } else {
                            btn.setStyle(ButtonStyle.Secondary)
                                .setCustomId(`symbols-${ownerId}-${symbolId}-${btnNum}`)
                                .setDisabled(confirmFilled);
                        }
                    }
                    newRow.addComponents(btn);
                }
                newRows.push(newRow);
            }
            await interaction.update({ components: newRows });
        }
    }

    autocomplete(interaction: AutocompleteInteraction) {
        const value = String(interaction.options.getFocused());
        const reply = Object.keys(symbol).filter(c => c.toLowerCase().startsWith(value.toLowerCase()));
        interaction.respond(reply.map(x => ({ name: x, value: x })));
    }
}
