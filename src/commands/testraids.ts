import {DBUser} from "../props/dbUser";

export async function testRaids(interaction,dcclient,d2client,DB){
    const discordID = interaction.data.options ? interaction.data.options[0].value : interaction.member.user.id;
    if(!DB.has(discordID)) return dcclient.interactionReply(interaction,{content: "The requested user has not registered with me."});
    dcclient.defer(interaction,{});
    let dbUser = DB.get(discordID) as DBUser;
    if(dbUser.raids === undefined){
        dbUser = await d2client.dbUserUpdater.updateStats(discordID);
    }
    const raidObject = dbUser.raids;
    const bungoName = await d2client.getBungieName(dbUser.bungieId);
    const embed = {
        "title": `Raid completions: ${bungoName}`,
        "color": 11413503,
        "description": `**${raidObject["Total"]}** total clears.`,
        "footer": {
            "icon_url": "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp",
            "text": "Argos, Planetary Core"
        },
        "fields": [
            {
                "name": "\u200B",
                "value":
                    `**King's Fall**
${raidObject["King's Fall, Legend"] + raidObject["King's Fall, Master"]} - M: ${raidObject["King's Fall, Master"]}

**Vault of Glass**
${raidObject["Vault of Glass, Normal"] + raidObject["Vault of Glass, Master"]} - M: ${raidObject["Vault of Glass, Master"]}

**Garden of Salvation**
${raidObject["Garden of Salvation"]}

**Crown of Sorrow**
${raidObject["Crown of Sorrow"]}

**Spire of Stars**
${raidObject["Leviathan, Spire of Stars, Normal"] + raidObject["Leviathan, Spire of Stars, Prestige"]} - P: ${raidObject["Leviathan, Spire of Stars, Prestige"]}

**Leviathan**
${raidObject["Leviathan, Normal"] + raidObject["Leviathan, Prestige"]} - P: ${raidObject["Leviathan, Prestige"]}`,
                "inline":true
            },
            {
                "name": "\u200B",
                "value":
                    `**Vow of the Disciple**
${raidObject["Vow of the Disciple, Normal"] + raidObject["Vow of the Disciple, Master"]} - M: ${raidObject["Vow of the Disciple, Master"]}

**Deep Stone Crypt**
${raidObject["Deep Stone Crypt"]}

**Last Wish**
${raidObject["Last Wish"]}

**Scourge of the Past**
${raidObject["Scourge of the Past"]}

**Eater of Worlds**
${raidObject["Leviathan, Eater of Worlds, Normal"] + raidObject["Leviathan, Eater of Worlds, Prestige"]} - P: ${raidObject["Leviathan, Eater of Worlds, Prestige"]}`,
                "inline":true
            }
        ]
    };
    dcclient.editReply(interaction,{
        embeds: [embed],
        components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${interaction.member.user.id}`}]}]
    });
}