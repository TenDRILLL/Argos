import Command from "./Command";

export default class xur extends Command {
    constructor(){
        super("xur");
    }

    async cmdRun(interaction, d2client){
        const embed = d2client.miscDB.get("xurEmbed");
        if (embed) {
            interaction.reply({embeds: [embed]})
        }
        else {
            interaction.reply({content: `Xur doesn't seem to be on any planet`})
        }
    }
}