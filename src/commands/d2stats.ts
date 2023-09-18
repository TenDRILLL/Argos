import Command from "./Command";
import {DBUser} from "../props/dbUser";
import {ActionRow, Button, ButtonStyle, Embed} from "discord-http-interactions";

export default class D2Stats extends Command {
    constructor(){
        super("d2stats");
    }

    async cmdRun(interaction,d2client){
        let discordID;
        const authorID = interaction.member ? interaction.member?.user?.id : interaction.user?.id;
        if (interaction.data["options"][0]["options"] !== undefined && interaction.data["options"][0]["options"].length === 1) {
            discordID = interaction.data["options"][0]["options"][0].value;
        } else {
            discordID = authorID;
        }
        if(!d2client.DB.has(discordID)) return interaction.reply({content: "The requested user has not registered with me.", ephemeral: true});
        await interaction.defer();
        let dbUser = d2client.DB.get(discordID) as DBUser;
        if(dbUser.stats === undefined || dbUser.raids == undefined || dbUser.dungeons == undefined || dbUser.grandmasters == undefined){
            dbUser = await d2client.dbUserUpdater.updateStats(discordID);
        }
        switch(interaction.data["options"][0]?.name){
            case "summary":
                this.summary(interaction,dbUser,authorID);
                break;
            case "raids":
                this.raids(interaction,dbUser,authorID,d2client);
                break;
            case "dungeons":
                this.dungeons(interaction,dbUser,authorID, d2client);
                break;
            case "grandmasters":
                this.grandmasters(interaction,dbUser,authorID, d2client);
                break;
            default:
                return interaction.editReply({
                    content: "Not implemented yet."
                }).catch(e => console.log(e));
        }
    }

    async summary(interaction,dbUser,authorID){
        const embed = new Embed()
            .setTitle(`${dbUser.destinyName}'s Stats`)
            .setColor(0xae27ff)
            .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
            .setFields([
                {"name": "Power Level", "value": `${dbUser.stats?.light ?? "UNKNOWN"}`, "inline": false},
                {"name": "Raids", "value": `${dbUser.raids?.Total ?? "UNKNOWN"}`, "inline": true},
                {"name": "Dungeons", "value": `${dbUser.dungeons?.Total ?? "UNKNOWN"}`, "inline": true},
                {"name": "Grandmasters", "value": `${dbUser.grandmasters?.Total ?? "UNKNOWN"}`, "inline": true},
                {"name": "PvP K/D", "value": `${Math.round((dbUser.stats?.kd ?? 0) * 100)/100}`}
            ]);
        this.sendEmbed(interaction,embed,authorID);
    }

    async raids(interaction,dbUser,authorID, d2client){
        const raidObject = dbUser.raids;
        const embed = new Embed()
            .setTitle(`Raid completions: ${dbUser.destinyName}`)
            .setColor(0xae27ff)
            .setDescription(`**${raidObject["Total"]}** total clears.`)
            .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
            .setFields(this.generateFields(d2client, raidObject, 2));
        this.sendEmbed(interaction,embed,authorID);
    }

    async dungeons(interaction,dbUser,authorID, d2client){
        const dungeonObject = dbUser.dungeons;
        const embed = new Embed()
            .setTitle(`Dungeon completions: ${dbUser.destinyName}`)
            .setColor(0xae27ff)
            .setDescription(`**${dungeonObject["Total"]}** total clears.`)
            .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
            .setFields(this.generateFields(d2client, dungeonObject, 2));
        this.sendEmbed(interaction,embed,authorID);
    }

    async grandmasters(interaction,dbUser,authorID, d2client){
        const GMObject = dbUser.grandmasters;
        const embed = new Embed()
            .setTitle(`Grandmaster completions: ${dbUser.destinyName}`)
            .setColor(0xae27ff)
            .setDescription(`**${GMObject["Total"]}** total clears.`)
            .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
            .setFields(this.generateFields(d2client, GMObject, 3));
        this.sendEmbed(interaction,embed,authorID);
    }

    sendEmbed(interaction,embed,authorID){
        interaction.editReply({
            embeds: [embed],
            components: [new ActionRow().setComponents([
                new Button()
                    .setLabel("Delete")
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`delete-${authorID}`)
            ])]
        }).catch(e => console.log(e));
    }

    generateFields(d2client,activityObject,number): {name: string, value: string, inline?: boolean}[] {
        const order = d2client.entityDB.get("activityOrder");
        const activityIdentifiers = d2client.activityIdentifierDB;
        let rows: {name: string, value: string, inline?: boolean}[] = [];
        for (let i = 0; i < number; i++) {
            rows.push({"name": "\u200B", "value": "", "inline": true});
        }
        delete activityObject["Total"];
        let j = 0;
        let ordered;
        if (number === 3) {
            ordered = Object.keys(activityObject)
                .filter(a => activityObject[a] !== 0)
                .sort((b,a) => activityObject[a] - activityObject[b]);
        }
        else {
            ordered = Object.keys(activityObject)
                .sort((b,a) => order.findIndex(e => e == a) - order.findIndex(e => e == b));
        }
        for (let i = 0; i < ordered.length; i++) {
            const activity = ordered[i];
            if (activity == undefined) {
                continue;
            }
            const displayName = activity.split(",").map(a => a.trim())[0] == "Leviathan" && activity.split(",").length != 1 ? activity.split(",").map(a => a.trim())[1] : activity;
            if (activityIdentifiers.get(activity)["difficultName"] != "") {
                const difficultNumber = activityObject[ordered[ordered.findIndex(e => e == `${activity}, ${activityIdentifiers.get(activity)["difficultName"]}`)]] ?? 0;
                delete ordered[ordered.findIndex(e => e == `${activity}, ${activityIdentifiers.get(activity)["difficultName"]}`)];
                rows[j % number]["value"] += `**${displayName}**
${activityObject[activity]} - ${activityIdentifiers.get(activity)["difficultName"].substring(0,1)}: ${difficultNumber}
    
`
                }
            else {
                rows[j % number]["value"] += `**${activity}**
${activityObject[activity]}

`
                }
            delete ordered[0];
            j += 1;
        }
        return rows;
    }
}