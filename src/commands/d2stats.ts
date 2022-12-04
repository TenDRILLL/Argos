import Command from "./Command";

export default class D2Stats extends Command {
    constructor(){
        super("d2stats");
    }

    async cmdRun(interaction){
        console.log(JSON.stringify(interaction.data.options)); //[{"name":"summary","options":[{"name":"user","type":6,"value":"484419124433518602"}],"type":1}]
        return interaction.reply({
            content: "Not implemented yet."
        }).catch(e => console.log(e));
    }
}