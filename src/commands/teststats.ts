import {DBUser} from "../props/dbUser";
import { Interaction } from "../handlers/discordHandler";
import {RawCommandInteractionData} from "../props/discord";

export async function testStats(interaction: Interaction,d2client,DB){
    let discordID;
    const authorID = interaction.member ? interaction.member?.user?.id : interaction.user?.id;
    if (interaction.data["options"]) {
        discordID = interaction.data["options"][0].value;
    } else if(interaction.member){
        discordID = interaction.member?.user?.id;
    } else {
        discordID = interaction.user?.id;
    }

    if(!DB.has(discordID)) return interaction.reply({content: "The requested user has not registered with me."});
    await interaction.defer();
    let dbUser = DB.get(discordID) as DBUser;
    if(dbUser.stats === undefined){
        dbUser = await d2client.dbUserUpdater.updateStats(discordID);
    }
    const bungoName = await d2client.getBungieName(dbUser.bungieId);
    interaction.editReply({
        content: `${bungoName}'s logged stats:
Light: ${dbUser.stats.light}
KD: ${dbUser.stats.kd}`,
        components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${authorID}`}]}]
    });
}