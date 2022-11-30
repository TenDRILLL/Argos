import Command from "./Command";

export default class Delete extends Command {
    constructor(){
        super("delete");
    }

    async btnRun(interaction){
        if(interaction.data.custom_id.split("-")[1] === interaction.member.user.id){
            return interaction.delete();
        } else {
            return interaction.reply({
                content: "This isn't your command.",
                flags: 64
            });
        }
    }
}