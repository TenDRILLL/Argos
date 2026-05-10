import DiscordCommand from "../../structs/DiscordCommand";
import {
    ChatInputCommandInteraction,
    ButtonInteraction,
    ModalSubmitInteraction,
    AutocompleteInteraction,
    ActionRowBuilder,
    ApplicationCommandOptionType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    ComponentType,
    Message
} from "discord.js";
import spacetime from "spacetime";
import { dbQuery } from "../../automata/Database";
import { lfgManager } from "../../automata/LFGManager";
import { userService } from "../../automata/UserService";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";
import { timezones } from "../../utils/timezones";

function buildLFGModal(customId: string, title: string, defaults?: { size?: string; time?: string; desc?: string }): ModalBuilder {
    const sizeInput = new TextInputBuilder()
        .setCustomId("lfg-size")
        .setLabel("Size of the fireteam")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2)
        .setPlaceholder("6");
    if (defaults?.size) sizeInput.setValue(defaults.size);

    const timeInput = new TextInputBuilder()
        .setCustomId("lfg-time")
        .setLabel("Time to start | (optional values)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(12)
        .setPlaceholder("HH:MM (DD.MM)");
    if (defaults?.time) timeInput.setValue(defaults.time);

    const descInput = new TextInputBuilder()
        .setCustomId("lfg-description")
        .setLabel("Description")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder("Chill cool raid, bring cookies :>");
    if (defaults?.desc) descInput.setValue(defaults.desc);

    return new ModalBuilder()
        .setTitle(title)
        .setCustomId(customId)
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(sizeInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
        );
}

export default class LFG extends DiscordCommand {
    constructor() {
        super("lfg", {
            name: "lfg",
            description: "Access LFG commands.",
            options: [
                {
                    name: "create",
                    description: "Create an LFG.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "type", description: "Type of an activity to create an LFG for.", type: ApplicationCommandOptionType.String, autocomplete: true, required: true },
                        { name: "activity", description: "The activity to create an LFG for.", type: ApplicationCommandOptionType.String, autocomplete: true, required: true }
                    ]
                },
                {
                    name: "timezone",
                    description: "Set your timezone for LFG.",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        { name: "set", description: "Set your timezone for LFG.", type: ApplicationCommandOptionType.String, autocomplete: true, required: true }
                    ]
                }
            ]
        });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const rows = await dbQuery("SELECT discord_id, timezone FROM users WHERE discord_id = ?", [userId]);
        if (rows.length === 0) {
            return interaction.reply({ content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience.", flags: MessageFlags.Ephemeral });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
            const activity = interaction.options.getString("activity", true);
            const dbUser = rows[0];

            if (!dbUser.timezone) {
                await dbQuery("UPDATE users SET timezone = 'Europe/Helsinki' WHERE discord_id = ?", [userId]);
                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("LFG Creation")
                            .setDescription("Hi! It seems that you haven't set your timezone yet. This means that as a default, your timezone will be set to Europe/Helsinki\nIf that isn't correct, you can change your timezone using the command\n</lfg timezone:1068987387121782895>")
                    ],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setLabel("Next")
                                .setStyle(ButtonStyle.Secondary)
                                .setCustomId(`lfg-create-${activity}`)
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.showModal(buildLFGModal(`lfg-${activity}`, "LFG Creation"));
        } else if (subcommand === "timezone") {
            const tz = interaction.options.getString("set", true);
            await dbQuery("UPDATE users SET timezone = ? WHERE discord_id = ?", [tz, userId]);
            interaction.reply({ content: `Saved timezone: ${tz}`, flags: MessageFlags.Ephemeral });
        }
    }

    async button(interaction: ButtonInteraction) {
        const userId = interaction.user.id;
        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [userId]);
        if (rows.length === 0) {
            return interaction.reply({ content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience.", flags: MessageFlags.Ephemeral });
        }

        const cmd = interaction.customId.split("-")[1];

        if (cmd === "create") {
            const activity = interaction.customId.split("-")[2];
            await interaction.showModal(buildLFGModal(`lfg-${activity}`, "LFG Creation"));
        } else if (cmd === "join") {
            const lfgid = interaction.customId.split("-")[2];
            let lfgData = lfgManager.getLFG(lfgid);
            if (!lfgData) return interaction.reply({ content: "No LFG found with the ID provided, please notify Administration.", flags: MessageFlags.Ephemeral });
            if (lfgData.guardians.includes(userId) || lfgData.queue.includes(userId)) {
                return interaction.reply({ content: "You're already in this LFG.", flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const oldEmbed = interaction.message.embeds[0];
            const fields = oldEmbed.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline }));

            if (lfgData.guardians.length === parseInt(lfgData.maxSize as string)) {
                lfgData.queue.push(userId);
                const names = await Promise.all(lfgData.queue.map(id => userService.getDestinyName(id)));
                fields[4].value = names.join(", ");
            } else {
                lfgData.guardians.push(userId);
                fields[3].name = `**Guardians Joined: ${lfgData.guardians.length}/${lfgData.maxSize}**`;
                const names = await Promise.all(lfgData.guardians.map(id => userService.getDestinyName(id)));
                fields[3].value = names.join(", ");
            }

            lfgManager.saveLFG(lfgData);

            const oldRow = (interaction.message.components as any[])[0];
            const buttons = (oldRow.components as any[]).map((c: any) => {
                if (c.type !== ComponentType.Button || !("customId" in c)) return null;
                return new ButtonBuilder().setCustomId(c.customId!).setLabel(c.label ?? "").setStyle(c.style as ButtonStyle);
            }).filter(Boolean) as ButtonBuilder[];

            if (lfgData.guardians.length === parseInt(lfgData.maxSize as string)) {
                buttons[0].setLabel("Join in Queue").setStyle(ButtonStyle.Primary);
            }

            await interaction.editReply({
                embeds: [EmbedBuilder.from(oldEmbed).setFields(fields)],
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)]
            });
        } else if (cmd === "leave") {
            const lfgid = interaction.customId.split("-")[2];
            let lfgData = lfgManager.getLFG(lfgid);
            if (!lfgData) return interaction.reply({ content: "No LFG found with the ID provided, please notify Administration.", flags: MessageFlags.Ephemeral });
            if (!lfgData.guardians.includes(userId) && !lfgData.queue.includes(userId)) {
                return interaction.reply({ content: "You're not in this LFG.", flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const oldEmbed = interaction.message.embeds[0];
            const fields = oldEmbed.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline }));

            const oldRow2 = (interaction.message.components as any[])[0];
            const buttons = (oldRow2.components as any[]).map((c: any) => {
                if (c.type !== ComponentType.Button || !("customId" in c)) return null;
                return new ButtonBuilder().setCustomId(c.customId!).setLabel(c.label ?? "").setStyle(c.style as ButtonStyle);
            }).filter(Boolean) as ButtonBuilder[];

            if (lfgData.queue.includes(userId)) {
                lfgData.queue.splice(lfgData.queue.indexOf(userId), 1);
                const names = await Promise.all(lfgData.queue.map(id => userService.getDestinyName(id)));
                fields[4].value = lfgData.queue.length === 0 ? "None." : names.join(", ");
            } else {
                lfgData.guardians.splice(lfgData.guardians.indexOf(userId), 1);
                if (lfgData.queue.length > 0) {
                    lfgData.guardians.push(lfgData.queue.shift()!);
                    const queueNames = await Promise.all(lfgData.queue.map(id => userService.getDestinyName(id)));
                    fields[4].value = queueNames.join(", ");
                } else {
                    buttons[0].setLabel("Join").setStyle(ButtonStyle.Success);
                    fields[4].value = "None.";
                }
                fields[3].name = `**Guardians Joined: ${lfgData.guardians.length}/${lfgData.maxSize}**`;
                const guardianNames = await Promise.all(lfgData.guardians.map(id => userService.getDestinyName(id)));
                fields[3].value = lfgData.guardians.length === 0 ? "None." : guardianNames.join(", ");
            }

            lfgManager.saveLFG(lfgData);

            await interaction.editReply({
                embeds: [EmbedBuilder.from(oldEmbed).setFields(fields)],
                components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)]
            });
        } else if (cmd === "editOptions") {
            const creatorId = interaction.customId.split("-")[3];
            const member = interaction.member as any;
            const hasPermission = member?.permissions?.has?.("ManageMessages") || member?.permissions?.has?.("MANAGE_MESSAGES");
            if (userId === creatorId || hasPermission) {
                interaction.reply({
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setCustomId(`lfg-delete-${interaction.customId.split("-")[2]}`)
                                .setLabel("Delete")
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId(`lfg-edit-${interaction.customId.split("-")[2]}`)
                                .setLabel("Edit")
                                .setStyle(ButtonStyle.Primary)
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            } else {
                interaction.reply({ content: "You can't edit a post that isn't yours.", flags: MessageFlags.Ephemeral });
            }
        } else if (cmd === "delete") {
            await interaction.deferUpdate();
            const lfgid = interaction.customId.split("-")[2];
            lfgManager.deleteLFG(lfgid);
            interaction.message.delete().catch(e => console.log(e));
        } else if (cmd === "edit") {
            const lfgid = interaction.customId.split("-")[2];
            const oldLFG = lfgManager.getLFG(lfgid);
            if (!oldLFG) return interaction.reply({ content: "LFG not found.", flags: MessageFlags.Ephemeral });
            const modal = buildLFGModal(`lfg-${lfgid}-edit`, "LFG Editing", {
                size: String(oldLFG.maxSize ?? 6),
                time: oldLFG.timeString,
                desc: oldLFG.desc ?? ""
            });
            await interaction.showModal(modal);
            interaction.message.delete().catch(() => {});
        }
    }

    async modalSubmit(interaction: ModalSubmitInteraction) {
        const size = interaction.fields.getTextInputValue("lfg-size");
        const timeString = interaction.fields.getTextInputValue("lfg-time");
        const desc = interaction.fields.getTextInputValue("lfg-description");

        if (isNaN(Number(size)) || parseInt(size) === 0) return;
        if (!(/^\d{2}:\d{2}($| \d{1,2}\.\d{1,2})/gi.test(timeString))) return;

        const userId = interaction.user.id;
        const dbRows = await dbQuery("SELECT destiny_name, timezone FROM users WHERE discord_id = ?", [userId]);
        const name = dbRows[0]?.destiny_name ?? userId;
        const timezone = dbRows[0]?.timezone ?? "Europe/Helsinki";

        const hour = parseInt(timeString.split(":")[0]);
        const minute = parseInt(timeString.split(":")[1].split(" ")[0]);
        let day: number | null = null;
        let month: number | null = null;
        if (timeString.split(" ").length === 2) {
            day = parseInt(timeString.split(" ")[1].split(".")[0]);
            month = parseInt(timeString.split(" ")[1].split(".")[1]) - 1;
        }
        let s = spacetime().goto(timezone).hour(hour).minute(minute).second(0).millisecond(0);
        if (day !== null && month !== null) {
            s = s.date(day).month(month);
        }
        const time = Math.floor(s.epoch / 1000);

        const embed = new EmbedBuilder()
            .setFields([
                { name: "**Activity**", value: interaction.customId.split("-")[1], inline: true },
                { name: "**Start Time:**", value: `<t:${time}:F>\n<t:${time}:R>`, inline: true },
                { name: "**Description:**", value: desc },
                { name: `**Guardians Joined: 1/${size}**`, value: name, inline: true },
                { name: "**Queue:**", value: "None.", inline: true }
            ]);

        const isEdit = interaction.customId.split("-")[2] === "edit";
        if (isEdit) {
            await interaction.deferUpdate();
            const lfgid = interaction.customId.split("-")[1];
            const oldLFG = lfgManager.getLFG(lfgid);
            if (!oldLFG) return;
            oldLFG.time = time;
            oldLFG.timeString = timeString;
            oldLFG.maxSize = size;
            oldLFG.desc = desc;
            lfgManager.editLFG(oldLFG, embed);
            return;
        }

        const response = await interaction.reply({ embeds: [embed], fetchReply: true }) as Message;
        const id = `${response.channelId}&${response.id}`;
        await interaction.editReply({
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setLabel(parseInt(size) === 1 ? "Join in Queue" : "Join")
                        .setStyle(parseInt(size) === 1 ? ButtonStyle.Primary : ButtonStyle.Success)
                        .setCustomId(`lfg-join-${id}`),
                    new ButtonBuilder()
                        .setLabel("Leave")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`lfg-leave-${id}`),
                    new ButtonBuilder()
                        .setLabel("Edit")
                        .setStyle(ButtonStyle.Secondary)
                        .setCustomId(`lfg-editOptions-${id}-${userId}`)
                )
            ]
        });

        lfgManager.saveLFG({
            id,
            activity: interaction.customId.split("-")[1],
            timeString,
            time,
            maxSize: size,
            creator: userId,
            guardians: [userId],
            queue: [],
            desc
        });
    }

    autocomplete(interaction: AutocompleteInteraction) {
        const option = interaction.options.getFocused(true);

        if (option.name === "activity") {
            const type = interaction.options.getString("type") ?? "";
            const sunsetRaids = ["Leviathan", "Leviathan, Eater of Worlds", "Leviathan, Spire of Stars", "Scourge of the Past", "Crown of Sorrow"];
            const sunsetDungeons = ["The Whisper", "Zero Hour", "Harbinger", "Presage"];
            let activities: string[] = [];
            switch (type) {
                case "Raid":
                    for (const [key, data] of activityIdentifierDB) {
                        if (data.type === 0 && !sunsetRaids.includes(key)) activities.push(key);
                    }
                    break;
                case "Dungeon":
                    for (const [key, data] of activityIdentifierDB) {
                        if (data.type === 1 && !sunsetDungeons.includes(key)) activities.push(key);
                    }
                    break;
                case "Crucible":
                    activities = ["Control", "Competitive", "Iron Banner", "Trials of Osiris", "Casual", "Private Crucible Match", "RNG Rumble"];
                    break;
                case "Gambit":
                    activities = ["Gambit", "Private Gambit Match"];
                    break;
                case "Seasonal":
                    activities = ["Seasonal Activity"];
                    break;
                case "Other":
                    activities = ["Grandmaster Nightfall", "Wellspring", "Dares of Eternity", "Other"];
                    break;
            }
            interaction.respond(
                activities
                    .filter(x => x.toLowerCase().startsWith(String(option.value).toLowerCase()))
                    .map(x => ({ name: x, value: x }))
            );
        } else if (option.name === "type") {
            const types = ["Raid", "Dungeon", "Crucible", "Gambit", "Seasonal", "Other"];
            interaction.respond(
                types
                    .filter(x => x.toLowerCase().startsWith(String(option.value).toLowerCase()))
                    .map(x => ({ name: x, value: x }))
            );
        } else if (option.name === "timezone") {
            const reply = timezones()
                .filter(x => {
                    const val = String(option.value).toLowerCase();
                    return x.toLowerCase().startsWith(val) || x.toLowerCase().split("/")[1]?.startsWith(val);
                })
                .map(x => ({ name: x, value: x }));
            if (reply.length > 25) reply.length = 25;
            interaction.respond(reply);
        }
    }
}
