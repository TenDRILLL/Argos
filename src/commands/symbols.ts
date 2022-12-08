import Command from "./Command";
import symbol from "../enums/symbol";

export default class Symbols extends Command {
    constructor(){
        super("symbols");
    }

    async cmdRun(interaction){
        const symbolObject = symbol[interaction.data.options[0].value];

        const embed = {
            color: 5064059,
            image: {url: symbolObject.imageURL},
            description: `${interaction.data.options[0].value} Symbols`,
            fields: [{name: "Activate the symbols required to unlock the Deepsight", value: "Click the respective buttons below."}]
        };

        const symbolButtons: SymbolButton[] = [];
        for(let i = 1; i <= symbolObject.symbolCount; i++){
            symbolButtons.push({type: 2, style: 2, custom_id: `symbols-${interaction.member.user.id}-${symbolObject.id}-${i}`, label: i.toString(), disabled: false});
        }

        const actionRows: SymbolActionRow[] = [];
        while(symbolButtons.length > 0){actionRows.push({type: 1, components: symbolButtons.splice(0,3)})}
        actionRows[actionRows.length-1].components = [...actionRows[actionRows.length-1].components, {custom_id: `symbols-${interaction.member.user.id}-${symbolObject.id}-confirm`, label: "Confirm", style: 1, type: 2, disabled: true}];
        actionRows.push({type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${interaction.member.user.id}`, disabled: false}]});
        interaction.reply({
            embeds: [embed],
            components: actionRows
        });
    }

    async btnRun(interaction) {
        if (interaction.data.custom_id.split("-")[1] !== interaction.member.user.id) return interaction.reply({content: "Please don't touch the buttons of others.", flags: 64});
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
            if(button.style === 2){
                button.style = 1;
                button.custom_id = `symbols-${interaction.member.user.id}-${symbolObject.id}-${num}-select`;
                selected++;
            } else {
                button.style = 2;
                button.custom_id = `symbols-${interaction.member.user.id}-${symbolObject.id}-${num}`;
                selected--;
            }
            components[numTimes].components[num-(numTimes*3)-1] = button;
            components[components.length-2].components[components[components.length-2].components.length-1].disabled = selected !== symbolObject.required;
            components.forEach(actionrow => {
                actionrow.components.forEach(button => {
                    if(button.style === 2){
                        button.disabled = selected === symbolObject.required;
                    }
                    button.type = 2;
                });
            });
            interaction.editReply({components: components});
        } else {
            let symbolIDs: string[] = [];
            let activityID = "";
            components.forEach(actionrow => {
                actionrow.components.forEach(button => {
                    if(button.style === 1){
                        if(activityID === "") activityID = button.custom_id.split("-")[2];
                        const num = button.custom_id.split("-")[3];
                        if(num !== "confirm") symbolIDs.push(num);
                    }
                });
            });

            const embeds: SymbolEmbed[] = [];
            if(symbolIDs.length > 10) symbolIDs = symbolIDs.slice(0,9);
            symbolIDs.forEach(symbolNumber => {
                embeds.push({
                    title: `SYMBOL: ${symbolNumber}`,
                    description: symbolObject.symbols[`${symbolNumber}`].location ?? "###LOCATION###",
                    image: {
                        url: symbolObject.symbols[`${symbolNumber}`].imageURL ?? "https://i.imgur.com/PygtZUa.png"
                    }
                });
            });

            interaction.editReply({
                components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${interaction.member.user.id}`, disabled: false}]}],
                embeds
            })
        }
    }


    async acRun(interaction){
        const value = interaction.data.options[0].value;
        const reply = Object.keys(symbol).filter(choice => choice.toLowerCase().startsWith(value.toLowerCase()));
        interaction.autocomplete({
            choices: reply.map(x => ({name: x, value: x}))
        });
    }
}

class SymbolButton {
    type: number;
    style: number;
    custom_id: string;
    label: string;
    disabled: boolean;
}

class SymbolActionRow {
    type: number;
    components: SymbolButton[];
}

class SymbolEmbed {
    title: string;
    description: string;
    image: {
        url: string;
    }
}