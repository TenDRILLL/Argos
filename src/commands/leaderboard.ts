import Command from "./Command";
import {DBUser} from "../props/dbUser";
import {ActionRow, Button, ButtonStyle, Embed} from "discord-http-interactions";

export default class Leaderboard extends Command {
    constructor() {
        super("leaderboard");
    }

    leaderboards: {name: string, value: string}[];

    cmdRun(interaction, d2client) {
        const authorID = interaction.member ? interaction.member?.user?.id : interaction.user?.id;
        const leaderboard: string = interaction.data.options[0].value;
        if (!(this.leaderboards.map(x => x.value).includes(leaderboard))) return interaction.reply({content: "Invalid leaderboard.", ephemeral: true});
        const all: {discordID: string, stat: number}[] = [];
        let stat: string[] = [];
        switch(leaderboard.split("-")[0]){
            case "kd":
                stat = ["stats","kd"];
                break;
            case "r":
                stat = ["raids",leaderboard.split("-")[1]];
                break;
            case "d":
                stat = ["dungeons",leaderboard.split("-")[1]];
                break;
            case "gm":
                stat = ["grandmasters",leaderboard.split("-")[1]];
                break;
            default:
                return interaction.reply({content: "Leaderboard not implemented."});
        }
        const ignore = ["handledApplications"];
        const dbKeys: string[] = Array.from(d2client.DB.keys());
        dbKeys.forEach(key => {
            if(ignore.includes(key)) return;
            const user = d2client.DB.get(key) as DBUser;
            if(user[stat[0].toString()][stat[1].toString()] !== undefined && user[stat[0].toString()][stat[1].toString()] !== 0){
                all.push({discordID: key, stat: user[stat[0].toString()][stat[1].toString()]});
            }
        });
        let fields: {name: string, value: string, inline?: boolean}[] = [
            {name: "\u200B", value: "\u200B", inline: true},
            {name: "\u200B", value: "\u200B", inline: true},
            {name: "\u200B", value: "\u200B", inline: true}
        ];
        all.sort((a, b) => b.stat - a.stat).forEach((entry,i) => {
            const pos = i % 3;
            fields[pos].value += `**#${i+1} <@${entry.discordID}>**
${leaderboard === "kd" ? entry.stat.toFixed(2) : entry.stat}

`;
        });
        interaction.reply({
            embeds: [
                new Embed()
                    .setDescription(`${this.leaderboards.find(x => x.value === leaderboard)?.name ?? "Leaderboard"}`)
                    .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
                    .setColor(11413503)
                    .setFields(fields)
            ],
            allowedMentions: {
                parse: []
            },
            components: [new ActionRow().setComponents([
                new Button()
                    .setLabel("Delete")
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId(`delete-${authorID}`)
            ])]
        });
    }

    acRun(interaction, d2client){
        const value = interaction.data.options[0].value;
        this.leaderboards = [{
            name: "Total Raid Completions",
            value: "r-Total"
        }, {
            name: "Total Dungeon Completions",
            value: "d-Total"
        }, {
            name: "Total Grandmaster Completions",
            value: "gm-Total"
        }, {
            name: "KD",
            value: "kd"
        }];
        for (let [key, data] of d2client.activityIdentifierDB) {
            if("difficultName" in data && data.difficultName !== "" && data.difficultName !== undefined){
                this.leaderboards.push({
                    name: `${key}, ${data["difficultName"]} Completions`,
                    value: `${["r","d","gm"][data["type"]]}-${key}, ${data.difficultName}`
                });
            }
            this.leaderboards.push({
                name: `${key} Completions`,
                value: `${["r","d","gm"][data["type"]]}-${key}`
            });
        }

        const reply = this.leaderboards.filter(choice => choice.name.toLowerCase().startsWith(value.toLowerCase()));
        if(reply.length > 25) reply.length = 25;
        interaction.autocomplete(reply);
    }
}