import {DBUser} from "../props/dbUser";

export async function testStats(interaction,dcclient,d2client,DB){
    const discordID = interaction.data.options ? interaction.data.options[0].value : interaction.member.user.id;
    if(!DB.has(discordID)) return dcclient.interactionReply(interaction,{content: "The requested user has not registered with me."});
    dcclient.defer(interaction,{});
    let dbUser = DB.get(discordID) as DBUser;
    if(dbUser.stats === undefined){
        dbUser = await d2client.dbUserUpdater.updateStats(discordID);
    }
    const bungoName = await d2client.getBungieName(dbUser.bungieId);
    dcclient.editReply(interaction,{
        content: `${bungoName}'s logged stats:
Light: ${dbUser.stats.light}
KD: ${dbUser.stats.kd}`,
        components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${interaction.member.user.id}`}]}]
    });
}