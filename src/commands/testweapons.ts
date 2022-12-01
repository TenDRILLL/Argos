import Command from "./Command";

export default class TestWeapons extends Command {
    constructor(){
        super("testweapons");
    }

    async cmdRun(interaction, d2client){
        interaction.reply({content: "Not implemented yet."}).catch(e => console.log(e));
    }
}