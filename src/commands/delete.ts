import Command from "./Command";

export default class Delete extends Command {
    constructor(){
        super("delete");
    }

    async btnRun(interaction){
        if(interaction.data.custom_id.split("-")[1] === interaction.member.user.id){
            interaction.delete().catch(e => console.log(e));
        } else {
            return interaction.reply({
                content: "This isn't your command.",
                ephemeral: true
            }).catch(e => console.log(e));
        }
    }
}