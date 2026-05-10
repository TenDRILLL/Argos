import DiscordCommand from "../../structs/DiscordCommand";
import {
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} from "discord.js";
import { dbQuery } from "../../automata/Database";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";

interface LeaderboardEntry {
    discordId: string;
    destinyName: string;
    stat: number;
}

interface LeaderboardOption {
    name: string;
    value: string;
}

async function fetchLeaderboard(leaderboard: string): Promise<LeaderboardEntry[]> {
    if (leaderboard === "kd") {
        const rows = await dbQuery("SELECT discord_id, destiny_name, stats_kd FROM users WHERE stats_kd > 0 AND destiny_name IS NOT NULL");
        return rows.map((r: any) => ({ discordId: r.discord_id, destinyName: r.destiny_name, stat: r.stats_kd }));
    }
    const dashIdx = leaderboard.indexOf("-");
    const typeStr = leaderboard.substring(0, dashIdx);
    const key = leaderboard.substring(dashIdx + 1);
    const typeMap: Record<string, number> = { r: 0, d: 1, gm: 2 };
    const actType = typeMap[typeStr] ?? 0;
    const rows = await dbQuery(
        "SELECT u.discord_id, u.destiny_name, a.clears FROM users u JOIN user_activities a ON u.discord_id = a.discord_id WHERE a.activity_type = ? AND a.activity_key = ? AND a.clears > 0 AND u.destiny_name IS NOT NULL",
        [actType, key]
    );
    return rows.map((r: any) => ({ discordId: r.discord_id, destinyName: r.destiny_name, stat: r.clears }));
}

export function buildLeaderboardOptions(): LeaderboardOption[] {
    const options: LeaderboardOption[] = [
        { name: "Total Raid Completions", value: "r-Total" },
        { name: "Total Dungeon Completions", value: "d-Total" },
        { name: "Total Grandmaster Completions", value: "gm-Total" },
        { name: "KD", value: "kd" }
    ];
    for (const [key, data] of activityIdentifierDB) {
        if (data.difficultName !== "") {
            options.push({
                name: `${key}, ${data.difficultName} Completions`,
                value: `${["r", "d", "gm"][data.type]}-${key}, ${data.difficultName}`
            });
        }
        options.push({
            name: `${key} Completions`,
            value: `${["r", "d", "gm"][data.type]}-${key}`
        });
    }
    return options;
}

export default class Leaderboard extends DiscordCommand {
    constructor() {
        super("leaderboard", {
            name: "leaderboard",
            description: "Display the leaderboard for the requested statistic.",
            options: [
                { type: ApplicationCommandOptionType.String, name: "name", description: "Name of the leaderboard.", required: true, autocomplete: true }
            ]
        });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const authorId = interaction.user.id;
        const leaderboard = interaction.options.getString("name", true);
        const leaderboards = buildLeaderboardOptions();

        if (!leaderboards.map(x => x.value).includes(leaderboard)) {
            return interaction.reply({ content: "Invalid leaderboard.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        let all = await fetchLeaderboard(leaderboard);
        const isKd = leaderboard === "kd";

        const fields: { name: string; value: string; inline?: boolean }[] = [
            { name: "Top 3", value: "", inline: false },
            { name: "​", value: "", inline: true },
            { name: "​", value: "", inline: true }
        ];
        let prevVal: string | number = 0;
        let prevPos = 0;
        let userInBoard = false;
        const top3 = all.sort((a, b) => b.stat - a.stat).slice(0, Math.min(3, all.length));
        all = all.slice(3);

        top3.forEach((entry, i) => {
            const value = isKd ? entry.stat.toFixed(2) : entry.stat;
            let pos: string | number;
            if (prevVal === value) {
                pos = prevPos;
            } else {
                pos = i + 1;
                prevPos = pos;
                prevVal = value;
            }
            switch (pos) {
                case 1: pos = "<:first:1061526156454666280>"; break;
                case 2: pos = "<:second:1061526192248852570>"; break;
                case 3: pos = "<:third:1061526230018560052>"; break;
                default: pos = `${pos})`;
            }
            let val = `${pos} ${entry.destinyName} *(${value})*`;
            if (authorId === entry.discordId) { val = `**${val}**`; userInBoard = true; }
            fields[0].value += `${val}\n`;
        });

        const length = Math.min(Math.floor(all.length / 2), 12);
        all.sort((a, b) => b.stat - a.stat).forEach((entry, i) => {
            if (i >= length * 2) return;
            const value = isKd ? entry.stat.toFixed(2) : entry.stat;
            let pos: string | number;
            if (prevVal === value) {
                pos = prevPos;
            } else {
                prevPos++;
                pos = prevPos;
                prevVal = value;
            }
            let val = `${pos}) ${entry.destinyName} *(${value})*`;
            if (authorId === entry.discordId) { val = `**${val}**`; userInBoard = true; }
            fields[i >= length ? 2 : 1].value += `${val}\n`;
        });

        fields[1].value = fields[1].value.replace(/\n$/, "");
        fields[2].value = fields[2].value.replace(/\n$/, "");

        if (!userInBoard) {
            const executer = all.find(x => x.discordId === authorId);
            fields.push({
                name: "...",
                value: executer
                    ? `**${all.indexOf(executer) + 4}) ${executer.destinyName} *(${isKd ? executer.stat.toFixed(2) : executer.stat})***`
                    : "You haven't got a score yet."
            });
        }

        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(leaderboards.find(x => x.value === leaderboard)?.name ?? "Leaderboard")
                    .setFooter({ text: "Argos, Planetary Core", iconURL: "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp" })
                    .setColor(0xae27ff)
                    .setFields(fields)
            ],
            allowedMentions: { parse: [] },
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel("Delete")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`delete-${authorId}`)
                )
            ]
        });
    }

    autocomplete(interaction: AutocompleteInteraction) {
        const value = String(interaction.options.getFocused());
        const leaderboards = buildLeaderboardOptions();
        const reply = leaderboards.filter(c => c.name.toLowerCase().startsWith(value.toLowerCase()));
        if (reply.length > 25) reply.length = 25;
        interaction.respond(reply);
    }
}
