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
            symbolButtons.push({type: 2, style: 2, custom_id: `symbols-${interaction.member.id}-${symbolObject.id}-${i}`, label: i.toString(), disabled: false});
        }

        const actionRows: SymbolActionRow[] = [];
        while(symbolButtons.length > 0){actionRows.push({type: 1, components: symbolButtons.splice(0,3)})}
        actionRows[actionRows.length-1].components = [...actionRows[actionRows.length-1].components, {custom_id: `symbols-${interaction.member.id}-${symbolObject.id}-confirm`, label: "Confirm", style: 1, type: 2, disabled: true}];

        interaction.reply({
            embeds: [embed],
            components: actionRows
        });
    }

    async btnRun(interaction){

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