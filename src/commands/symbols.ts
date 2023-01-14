import Command from "./Command";
import symbol from "../enums/symbol";
import {ActionRow, Button, ButtonStyle, Embed} from "discord-http-interactions";

export default class Symbols extends Command {
    constructor(){
        super("symbols");
    }

    async cmdRun(interaction){
        const symbolObject = symbol[interaction.data.options[0].value];
        const embed = new Embed()
            .setColor(5064059)
            .setImage(symbolObject.imageURL)
            .setDescription(`${interaction.data.options[0].value} Symbols`)
            .setFields([
                {name: "Activate the symbols required to unlock the Deepsight", value: "Click the respective buttons below."}
            ]);

        const symbolButtons: Button[] = [];
        for(let i = 1; i <= symbolObject.symbolCount; i++){
            symbolButtons.push(
                new Button()
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId(`symbols-${interaction.member.user.id}-${symbolObject.id}-${i}`)
                    .setLabel(i.toString())
                    .setDisabled(false)
            );
        }

        const actionRows: ActionRow[] = [];
        while(symbolButtons.length > 0) actionRows.push(
            new ActionRow().setComponents(symbolButtons.splice(0,3))
        );
        actionRows[actionRows.length-1].addComponents([
            new Button()
                .setCustomId(`symbols-${interaction.member.user.id}-${symbolObject.id}-confirm`)
                .setLabel("Confirm")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
        ]);
        actionRows.push(
            new ActionRow().setComponents([
                new Button()
                    .setLabel("Delete")
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`delete-${interaction.member.user.id}`)
                    .setDisabled(false)
            ])
        );
        interaction.reply({
            embeds: [embed],
            components: actionRows
        });
    }

    async btnRun(interaction) {
        if (interaction.data.custom_id.split("-")[1] !== interaction.member.user.id) return interaction.reply({content: "Please don't touch the buttons of others.", ephemeral: true});
        await interaction.update();
        const symbolObject = symbol[interaction.data.custom_id.split("-")[2]];
        let selected = 0;
        const components = interaction.message.components;
        components.forEach(actionrow => {
            actionrow.components.forEach(button => {
                if(button.custom_id.split("-").length === 5) selected++;
            });
        });
        if(interaction.data.custom_id.split("-")[3] !== "confirm"){
            const num = parseInt(interaction.data.custom_id.split("-")[3]);
            const numTimes = Math.floor((num-1)/3);
            const button = components[numTimes].components[num-(numTimes*3)-1];
            if(button.style === ButtonStyle.Secondary){
                button.setStyle(ButtonStyle.Primary);
                button.setCustomId(`symbols-${interaction.member.user.id}-${symbolObject.id}-${num}-select`);
                selected++;
            } else {
                button.setStyle(ButtonStyle.Secondary);
                button.setCustomId(`symbols-${interaction.member.user.id}-${symbolObject.id}-${num}`);
                selected--;
            }
            components[numTimes].components[num-(numTimes*3)-1] = button;
            components[components.length-2].components[components[components.length-2].components.length-1].disabled = selected !== symbolObject.required;
            components.forEach(actionrow => {
                actionrow.components.forEach(button => {
                    if(button.style === ButtonStyle.Secondary){
                        button.setDisabled(selected === symbolObject.required);
                    }
                });
            });
            interaction.editReply({components: components});
        } else {
            let symbolIDs: string[] = [];
            let activityID = "";
            components.forEach(actionrow => {
                actionrow.components.forEach(button => {
                    if(button.style === ButtonStyle.Primary){
                        if(activityID === "") activityID = button.custom_id.split("-")[2];
                        const num = button.custom_id.split("-")[3];
                        if(num !== "confirm") symbolIDs.push(num);
                    }
                });
            });

            const embeds: Embed[] = [];
            if(symbolIDs.length > 10) symbolIDs = symbolIDs.slice(0,9);
            symbolIDs.forEach(symbolNumber => {
                embeds.push(
                    new Embed()
                        .setTitle(`SYMBOL: ${symbolNumber}`)
                        .setDescription(symbolObject.symbols[`${symbolNumber}`].location ?? "###LOCATION###")
                        .setImage(symbolObject.symbols[`${symbolNumber}`].imageURL ?? "https://i.imgur.com/PygtZUa.png")
                );
            });

            interaction.editReply({
                components: [new ActionRow().setComponents([
                    new Button()
                        .setLabel("Delete")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`delete-${interaction.member.user.id}`)
                        .setDisabled(false)
                ])],
                embeds
            })
        }
    }

    async acRun(interaction){
        const value = interaction.data.options[0].value;
        const reply = Object.keys(symbol).filter(choice => choice.toLowerCase().startsWith(value.toLowerCase()));
        interaction.autocomplete(reply.map(x => ({name: x, value: x})));
    }
}