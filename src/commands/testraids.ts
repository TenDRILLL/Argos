import {DBUser} from "../props/dbUser";
import Command from "./Command";

export default class TestRaids extends Command {
    constructor(){
        super("testraids");
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
${raidObject["King's Fall"] + raidObject["King's Fall, Master"]} - M: ${raidObject["King's Fall, Master"]}

**Vault of Glass**
${raidObject["Vault of Glass"] + raidObject["Vault of Glass, Master"]} - M: ${raidObject["Vault of Glass, Master"]}

**Garden of Salvation**
${raidObject["Garden of Salvation"]}

**Crown of Sorrow**
${raidObject["Crown of Sorrow"]}

**Spire of Stars**
${raidObject["Leviathan, Spire of Stars"] + raidObject["Leviathan, Spire of Stars, Prestige"]} - P: ${raidObject["Leviathan, Spire of Stars, Prestige"]}

**Leviathan**
${raidObject["Leviathan"] + raidObject["Leviathan, Prestige"]} - P: ${raidObject["Leviathan, Prestige"]}`,
                    "inline":true
                },
                {
                    "name": "\u200B",
                    "value":
                        `**Vow of the Disciple**
${raidObject["Vow of the Disciple"] + raidObject["Vow of the Disciple, Master"]} - M: ${raidObject["Vow of the Disciple, Master"]}

**Deep Stone Crypt**
${raidObject["Deep Stone Crypt"]}

**Last Wish**
${raidObject["Last Wish"]}

**Scourge of the Past**
${raidObject["Scourge of the Past"]}

**Eater of Worlds**
${raidObject["Leviathan, Eater of Worlds"] + raidObject["Leviathan, Eater of Worlds, Prestige"]} - P: ${raidObject["Leviathan, Eater of Worlds, Prestige"]}`,
                    "inline":true
                }
            ]
        };
        interaction.editReply({
            embeds: [embed],
            components: [{type: 1, components: [{type: 2, label: "Delete", style: 4, custom_id: `delete-${authorID}`}]}]
        }).catch(e => console.log(e));
    }
}