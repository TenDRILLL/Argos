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
        let all: {name: string, stat: number, discordID: string}[] = [];
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
        const dbKeys: string[] = Array.from(d2client.DB.keys());
        dbKeys.forEach(key => {
            const user = d2client.DB.get(key) as DBUser;
            if(user[stat[0].toString()][stat[1].toString()] !== undefined && user[stat[0].toString()][stat[1].toString()] !== 0){
                all.push({name: user.destinyName, stat: user[stat[0].toString()][stat[1].toString()], discordID: key});
            }
        });
        const fields: {name: string, value: string, inline?: boolean}[] = [
            {name: "Top 3", value: "", inline: false},
            {name: "\u200B", value: "", inline: true},
            {name: "\u200B", value: "", inline: true}
        ];
        let prevVal: string | number = 0;
        let prevPos = 0;
        let userInBoard = false;
        const top3 = all.sort((a, b) => b.stat - a.stat).slice(0, all.length >= 3 ? 3 : all.length);
        all = all.slice(3);
        top3.forEach((entry,i) => {
            const value = leaderboard === "kd" ? entry.stat.toFixed(2) : entry.stat;
            let pos;
            if(prevVal === value){
                pos = prevPos;
            } else {
                pos = i+1;
                prevPos = pos;
                prevVal = value;
            }
            switch(pos){
                case 1:
                    pos = "<:first:1061526156454666280>";
                    break;
                case 2:
                    pos = "<:second:1061526192248852570>";
                    break;
                case 3:
                    pos = "<:third:1061526230018560052>";
                    break;
                default:
                    pos += ")"
            }
            let val = `${pos} ${entry.name} *(${value})*`;
            if(authorID === entry.discordID) {
                val = `**${val}**`;
                userInBoard = true;
            }
            return fields[0].value += `${val}
`;
        });
        const length = all.length/2 > 12 ? 12 : all.length/2;
        all.sort((a, b) => b.stat - a.stat).forEach((entry,i) => {
            if(i >= length*2) return;
            const value = leaderboard === "kd" ? entry.stat.toFixed(2) : entry.stat;
            let pos;
            if(prevVal === value){
                pos = prevPos;
            } else {
                prevPos++;
                pos = prevPos;
                prevVal = value;
            }
            let val = `${pos}) ${entry.name} *(${value})*`;
            if(authorID === entry.discordID) {
                val = `**${val}**`;
                userInBoard = true;
            }
            return fields[i >= length ? 2 : 1].value += `${val}
`;
        });
        fields[1].value = fields[1].value.substring(0, fields[1].value.length - 1);
        fields[2].value = fields[2].value.substring(0, fields[2].value.length - 1);
        if(!userInBoard){
            const executer = all.find(x => x.discordID === authorID);
            fields.push({
                name: "...",
                value: executer ? `**${all.indexOf(executer)+4}) ${executer.name} *(${leaderboard === "kd" ? executer.stat.toFixed(2) : executer.stat})***` : "You haven't got a score yet.",
            });
        }
        interaction.reply({
            embeds: [
                new Embed()
                    .setDescription(`${this.leaderboards.find(x => x.value === leaderboard)?.name ?? "Leaderboard"}`)
                    .setFooter("Argos, Planetary Core","https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp")
                    .setColor(0xae27ff)
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