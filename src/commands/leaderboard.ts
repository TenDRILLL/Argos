import Command from "./Command";
import {DBUser} from "../props/dbUser";

export default class Leaderboard extends Command {
    constructor() {
        super("leaderboard");
    }

    leaderboards: {name: string, value: string}[] = [
        {
            name: "Total Raid Completions",
            value: "r-all"
        }, {
            name: "Total Dungeon Completions",
            value: "d-all"
        }, {
            name: "Total Grandmaster Completions",
            value: "gm-all"
        }, {
            name: "KD",
            value: "kd"
        }
    ];

    cmdRun(interaction, d2client) {
        const leaderboard = interaction.data.options[0].value;
        if (!(this.leaderboards.map(x => x.value).includes(leaderboard))) return interaction.reply({content: "Invalid leaderboard.", ephemeral: true});
        if(leaderboard === "kd"){
            const all: {discordID: string, kd: number}[] = [];
            const ignore = ["handledApplications"];
            const dbKeys: string[] = Array.from(d2client.DB.keys());
            dbKeys.forEach(key => {
                if(ignore.includes(key)) return;
                const user = d2client.DB.get(key) as DBUser;
                if(user.stats.kd !== undefined){
                    all.push({discordID: key, kd: user.stats.kd});
                }
            });
            let str: string[] = [];
            all.sort((a, b) => b.kd - a.kd).forEach(entry => {
                str.push(`<@${entry.discordID}> - ${entry.kd.toFixed(2)}`);
            });
            interaction.reply({
                content: `KD leaderboard test:
${str.join("\n")}`,
                allowed_mentions: {
                    parse: []
                }
            });
        }
    }


    acRun(interaction){
        const value = interaction.data.options[0].value;
        const reply = this.leaderboards.filter(choice => choice.name.toLowerCase().startsWith(value.toLowerCase()));
        interaction.autocomplete(reply);
    }
}