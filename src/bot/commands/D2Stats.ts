import DiscordCommand from "../../structs/DiscordCommand";
import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} from "discord.js";
import { dbQuery } from "../../automata/Database";
import { userService } from "../../automata/UserService";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";
import { UserStats, ActivityObject } from "../../structs/DBUser";
import { patternService, PatternProgressMap } from "../../automata/PatternService";
import { RAID_GROUPS, RAID_NAMES, RaidGroup } from "../../enums/raidWeaponPatterns";

const EMBED_COLOR  = 0xae27ff;
const FOOTER_TEXT  = "Argos, Planetary Core";
const FOOTER_ICON  = "https://cdn.discordapp.com/avatars/1045324859586125905/0adce6b64cba7496675aa7b1c725ab23.webp";
const PATTERNS_PER_WEAPON = 5;

function bar5(progress: number): string {
    const filled = Math.min(Math.max(progress, 0), PATTERNS_PER_WEAPON);
    return "█".repeat(filled) + "░".repeat(PATTERNS_PER_WEAPON - filled);
}

function bar10(progress: number, total: number): string {
    if (total === 0) return "░".repeat(10);
    const filled = Math.round((progress / total) * 10);
    return "█".repeat(Math.min(filled, 10)) + "░".repeat(Math.max(10 - filled, 0));
}


export default class D2Stats extends DiscordCommand {
    constructor() {
        super("d2stats", {
            name: "d2stats",
            description: "Get Destiny 2 statistics of yourself or the requested user.",
            options: [
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "summary",
                    description: "Requested user's general statistics Argos monitors.",
                    options: [{ type: ApplicationCommandOptionType.User, name: "user", description: "The Discord user whose stats you wish to request.", required: false }]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "raids",
                    description: "Requested user's raid completions per raid.",
                    options: [{ type: ApplicationCommandOptionType.User, name: "user", description: "The Discord user whose stats you wish to request.", required: false }]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "dungeons",
                    description: "Requested user's dungeon completions per dungeon.",
                    options: [{ type: ApplicationCommandOptionType.User, name: "user", description: "The Discord user whose stats you wish to request.", required: false }]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "grandmasters",
                    description: "Requested user's Grandmaster Nightfall completions per Grandmaster Nightfall.",
                    options: [{ type: ApplicationCommandOptionType.User, name: "user", description: "The Discord user whose stats you wish to request.", required: false }]
                },
                {
                    type: ApplicationCommandOptionType.Subcommand,
                    name: "patterns",
                    description: "Raid weapon pattern progress — total overview or per-raid breakdown.",
                    options: [
                        {
                            type: ApplicationCommandOptionType.User,
                            name: "user",
                            description: "The Discord user to check.",
                            required: false,
                        },
                        {
                            type: ApplicationCommandOptionType.String,
                            name: "raid",
                            description: "Specific raid, or leave blank for all-raids overview.",
                            required: false,
                            autocomplete: true,
                        },
                    ],
                },
            ]
        });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const authorId   = interaction.user.id;
        const targetUser = interaction.options.getUser("user", false);
        const discordId  = targetUser?.id ?? authorId;

        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [discordId]);
        if (rows.length === 0) {
            return interaction.reply({ content: "The requested user has not registered with me.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();
        const sub = interaction.options.getSubcommand(false);

        if (sub === "patterns") {
            return this.patterns(interaction, discordId, authorId);
        }

        const dbUser = await userService.updateStats(discordId);

        switch (sub) {
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

    autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "raid") {
            interaction.respond([]).catch(() => {});
            return;
        }
        const query = focused.value.toLowerCase();
        const choices = RAID_NAMES
            .filter(name => name.toLowerCase().includes(query))
            .slice(0, 25)
            .map(name => ({ name, value: name }));
        interaction.respond(choices).catch(() => {});
    }

    private async patterns(interaction: ChatInputCommandInteraction, discordId: string, authorId: string) {
        const userRows = await dbQuery(
            "SELECT destiny_id, membership_type, destiny_name FROM users WHERE discord_id = ?",
            [discordId]
        );
        if (!userRows[0]?.destiny_id) {
            return interaction.editReply({ content: "No Destiny account linked for this user." });
        }

        const { destiny_id, membership_type, destiny_name } = userRows[0];
        const raidFilter = interaction.options.getString("raid", false);

        let progressMap: PatternProgressMap;
        try {
            progressMap = await patternService.getProgress(membership_type, destiny_id);
        } catch (e) {
            console.error("PatternService.getProgress failed:", e);
            return interaction.editReply({ content: "Failed to fetch pattern data from Bungie API." });
        }

        if (patternService.hashCount === 0) {
            return interaction.editReply({ content: "Pattern hash lookup failed — manifest may be unavailable. Try again shortly." });
        }

        if (raidFilter) {
            const raidGroup = RAID_GROUPS.find(r => r.name === raidFilter);
            if (!raidGroup) return interaction.editReply({ content: "Unknown raid name." });
            return this.sendRaidEmbed(interaction, raidGroup, progressMap, destiny_name, authorId);
        } else {
            return this.sendTotalEmbed(interaction, progressMap, destiny_name, authorId);
        }
    }

    private async sendTotalEmbed(
        interaction: ChatInputCommandInteraction,
        progressMap: PatternProgressMap,
        destinyName: string,
        authorId: string
    ) {
        const emojiCache = await interaction.client.application.emojis.fetch().catch(() => null);
        let grandTotal = 0;
        let grandCollected = 0;

        const fields = RAID_GROUPS.map(raid => {
            const raidTotal     = raid.weapons.length * PATTERNS_PER_WEAPON;
            const raidCollected = raid.weapons.reduce((sum, w) => {
                const p = progressMap.get(w.name);
                return sum + (p ? Math.min(p.progress, PATTERNS_PER_WEAPON) : 0);
            }, 0);

            grandTotal     += raidTotal;
            grandCollected += raidCollected;

            const raidEmoji = emojiCache?.find((e: any) => e.name === raid.shortName.toLowerCase());
            const emojiStr  = raidEmoji ? raidEmoji.toString() : "";
            const progress  = `${bar10(raidCollected, raidTotal)}  **${raidCollected} / ${raidTotal}**`;

            return {
                name:   `${emojiStr}  ${raid.name}`,
                value:  progress,
                inline: true,
            };
        });

        const overallPct = grandTotal > 0 ? Math.round((grandCollected / grandTotal) * 100) : 0;

        const embed = new EmbedBuilder()
            .setTitle("Raid Weapon Patterns")
            .setColor(EMBED_COLOR)
            .setAuthor({ name: destinyName })
            .setDescription(`**${grandCollected} / ${grandTotal}** patterns collected  ·  ${overallPct}%
-# Use: \`/d2stats patterns raid:\` for specifics.`)
            .setFields(fields)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON });

        this.sendEmbed(interaction, embed, authorId);
    }

    private async sendRaidEmbed(
        interaction: ChatInputCommandInteraction,
        raid: RaidGroup,
        progressMap: PatternProgressMap,
        destinyName: string,
        authorId: string
    ) {
        const emojiCache = await interaction.client.application.emojis.fetch().catch(() => null);
        const raidEmoji  = emojiCache?.find((e: any) => e.name === raid.shortName.toLowerCase());
        const emojiURL   = raidEmoji ? (raidEmoji as any).imageURL() : null;
        const raidTotal  = raid.weapons.length * PATTERNS_PER_WEAPON;
        let raidCollected = 0;

        const fields = raid.weapons.map(weapon => {
            const p         = progressMap.get(weapon.name);
            const progress  = p ? Math.min(p.progress, PATTERNS_PER_WEAPON) : 0;
            const cv        = PATTERNS_PER_WEAPON;
            raidCollected  += progress;

            const barStr   = bar5(progress);
            const fraction = `**${progress} / ${cv}**`;

            return {
                name:   `${weapon.name}  ·  *${weapon.type}*`,
                value:  `${barStr}  ${fraction}`,
                inline: true,
            };
        });

        const pct = raidTotal > 0 ? Math.round((raidCollected / raidTotal) * 100) : 0;

        const embed = new EmbedBuilder()
            .setTitle(`${raid.name}  ·  Patterns`)
            .setColor(EMBED_COLOR)
            .setAuthor({ name: destinyName })
            .setDescription(`**${raidCollected} / ${raidTotal}** patterns  ·  ${pct}%`)
            .setThumbnail(emojiURL)
            .setFields(fields)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON });

        this.sendEmbed(interaction, embed, authorId);
    }

    private summary(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`${dbUser.destiny_name}'s Stats`)
            .setColor(EMBED_COLOR)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON })
            .setFields([
                { name: "Power Level",  value: `${dbUser.stats?.light ?? "UNKNOWN"}`, inline: false },
                { name: "Raids",        value: `${dbUser.raids?.Total ?? "UNKNOWN"}`,       inline: true },
                { name: "Dungeons",     value: `${dbUser.dungeons?.Total ?? "UNKNOWN"}`,    inline: true },
                { name: "Grandmasters", value: `${dbUser.grandmasters?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "PvP K/D",      value: `${Math.round((dbUser.stats?.kd ?? 0) * 100) / 100}` }
            ]);
        this.sendEmbed(interaction, embed, authorId);
    }

    private raids(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Raid completions: ${dbUser.destiny_name}`)
            .setColor(EMBED_COLOR)
            .setDescription(`**${dbUser.raids["Total"]}** total clears.`)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON })
            .setFields(this.generateFields(dbUser.raids, 2));
        this.sendEmbed(interaction, embed, authorId);
    }

    private dungeons(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Dungeon completions: ${dbUser.destiny_name}`)
            .setColor(EMBED_COLOR)
            .setDescription(`**${dbUser.dungeons["Total"]}** total clears.`)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON })
            .setFields(this.generateFields(dbUser.dungeons, 2));
        this.sendEmbed(interaction, embed, authorId);
    }

    private grandmasters(interaction: ChatInputCommandInteraction, dbUser: UserStats, authorId: string) {
        const embed = new EmbedBuilder()
            .setTitle(`Grandmaster completions: ${dbUser.destiny_name}`)
            .setColor(EMBED_COLOR)
            .setDescription(`**${dbUser.grandmasters["Total"]}** total clears.`)
            .setFooter({ text: FOOTER_TEXT, iconURL: FOOTER_ICON })
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
