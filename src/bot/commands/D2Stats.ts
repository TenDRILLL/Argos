import DiscordCommand from "../../structs/DiscordCommand";
import {
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} from "discord.js";
import { dbQuery } from "../../automata/Database";
import { userService } from "../../automata/UserService";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";
import { UserStats, ActivityObject } from "../../structs/DBUser";

export default class D2Stats extends DiscordCommand {
    constructor() {
        super("d2stats", { name: "d2stats", description: "View Destiny 2 stats." });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const authorId = interaction.user.id;
        const targetUser = interaction.options.getUser("user", false);
        const discordId = targetUser?.id ?? authorId;

        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discordId]);
        if (rows.length === 0) {
            return interaction.reply({ content: "The requested user has not registered with me.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();
        const dbUser = await userService.updateStats(discordId);

        switch (interaction.options.getSubcommand(false)) {
            case "summary":
                this.summary(interaction, dbUser, authorId);
                break;
            case "raids":
                this.raids(interaction, dbUser, authorId);
                break;
            case "dungeons":
                this.dungeons(interaction, dbUser, authorId);
                break;
            case "grandmasters":
                this.grandmasters(interaction, dbUser, authorId);
                break;
            default:
                interaction.editReply({ content: "Not implemented yet." }).catch(e => console.log(e));
        }
    }

    private summary(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`${dbUser.destiny_name}'s Stats`)
            .setColor(0xae27ff)
            .setFooter({ text: "Argos, Planetary Core", iconURL: "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp" })
            .setFields([
                { name: "Power Level", value: `${dbUser.stats?.light ?? "UNKNOWN"}`, inline: false },
                { name: "Raids", value: `${dbUser.raids?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "Dungeons", value: `${dbUser.dungeons?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "Grandmasters", value: `${dbUser.grandmasters?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "PvP K/D", value: `${Math.round((dbUser.stats?.kd ?? 0) * 100) / 100}` }
            ]);
        this.sendEmbed(interaction, embed, authorId);
    }

    private raids(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Raid completions: ${dbUser.destiny_name}`)
            .setColor(0xae27ff)
            .setDescription(`**${dbUser.raids["Total"]}** total clears.`)
            .setFooter({ text: "Argos, Planetary Core", iconURL: "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp" })
            .setFields(this.generateFields(dbUser.raids, 2));
        this.sendEmbed(interaction, embed, authorId);
    }

    private dungeons(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Dungeon completions: ${dbUser.destiny_name}`)
            .setColor(0xae27ff)
            .setDescription(`**${dbUser.dungeons["Total"]}** total clears.`)
            .setFooter({ text: "Argos, Planetary Core", iconURL: "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp" })
            .setFields(this.generateFields(dbUser.dungeons, 2));
        this.sendEmbed(interaction, embed, authorId);
    }

    private grandmasters(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Grandmaster completions: ${dbUser.destiny_name}`)
            .setColor(0xae27ff)
            .setDescription(`**${dbUser.grandmasters["Total"]}** total clears.`)
            .setFooter({ text: "Argos, Planetary Core", iconURL: "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp" })
            .setFields(this.generateFields(dbUser.grandmasters, 3));
        this.sendEmbed(interaction, embed, authorId);
    }

    private sendEmbed(interaction: ChatInputCommandInteraction, embed: EmbedBuilder, authorId: string) {
        interaction.editReply({
            embeds: [embed],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel("Delete")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`delete-${authorId}`)
                )
            ]
        }).catch(e => console.log(e));
    }

    private generateFields(activityObject: ActivityObject, number: number): { name: string; value: string; inline?: boolean }[] {
        const order = Array.from(activityIdentifierDB.keys());
        const rows: { name: string; value: string; inline?: boolean }[] = [];
        for (let i = 0; i < number; i++) {
            rows.push({ name: "​", value: "", inline: true });
        }
        const obj = { ...activityObject };
        delete obj["Total"];

        let j = 0;
        let ordered: (string | undefined)[];
        if (number === 3) {
            ordered = Object.keys(obj).filter(a => obj[a] !== 0).sort((b, a) => obj[a] - obj[b]);
        } else {
            ordered = Object.keys(obj).sort((b, a) => order.findIndex(e => e === a) - order.findIndex(e => e === b));
        }

        for (let i = 0; i < ordered.length; i++) {
            const activity = ordered[i];
            if (activity === undefined) continue;
            const parts = activity.split(",").map(a => a.trim());
            const displayName = parts[0] === "Leviathan" && parts.length !== 1 ? parts[1] : activity;
            const identifier = activityIdentifierDB.get(activity);
            if (identifier && identifier.difficultName !== "") {
                const difficultKey = `${activity}, ${identifier.difficultName}`;
                const difficultIdx = ordered.findIndex(e => e === difficultKey);
                const difficultNumber = obj[ordered[difficultIdx] as string] ?? 0;
                delete ordered[difficultIdx];
                rows[j % number]["value"] += `**${displayName}**\n${obj[activity]} - ${identifier.difficultName.substring(0, 1)}: ${difficultNumber}\n\n`;
            } else {
                rows[j % number]["value"] += `**${activity}**\n${obj[activity]}\n\n`;
            }
            delete (ordered as any)[0];
            j += 1;
        }
        return rows;
    }
}
