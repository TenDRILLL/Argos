import {DBUser} from "../props/dbUser";
import Command from "./Command";

export default class TestStats extends Command {
    constructor(){
        super("teststats");
    }

    async cmdRun(interaction, d2client){
        let discordID;
        const authorID = interaction.member ? interaction.member?.user?.id : interaction.user?.id;
        if (interaction.data["options"] !== undefined) {
            discordID = interaction.data["options"][0].value;
        } else if(interaction.member){
            discordID = interaction.member?.user?.id;
        } else {
            discordID = interaction.user?.id;
        }

        if(!d2client.DB.has(discordID)) return interaction.reply({content: "The requested user has not registered with me.", flags: 64});
        await interaction.defer();
        let dbUser = d2client.DB.get(discordID) as DBUser;
        if(dbUser.stats === undefined){
            await d2client.dbUserUpdater.updateStats(discordID);
            dbUser = d2client.DB.get(discordID) as DBUser;
        }
        const bungoName = await d2client.getBungieName(dbUser.bungieId);
        interaction.editReply({
            content: `${bungoName}'s logged stats:
Light: ${dbUser.stats.light}
KD: ${dbUser.stats.kd}`,
            components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${authorID}`}]}]
        }).catch(e => console.log(e));
    }
}