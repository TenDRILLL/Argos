import Command from "./Command";
import {ActionRow, Button, ButtonStyle, ChannelSelectMenu, Embed, Emoji, MentionableSelectMenu, Modal, RoleSelectMenu, SelectMenuType, StringSelectMenu, TextInput, TextInputStyle} from "discord-http-interactions";
import spacetime from "spacetime";
import { timezones } from "../utils/timezones";

export default class LFG extends Command {
    constructor(){
        super("lfg");
    }

    async cmdRun(interaction, d2client) {
        if(!(d2client.DB.has(interaction.member.user.id))) return interaction.reply({content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience.", ephemeral: true});
        if(interaction.data.options[0].name === "create"){
            const activity = interaction.data.options[0].options[1].value;
            let dbUser = d2client.DB.get(interaction.member.user.id);
            if(dbUser.timezone === undefined) { dbUser.timezone = "Europe/Helsinki"; d2client.DB.set(interaction.member.user.id, "Europe/Helsinki", "timezone");
                interaction.reply({
                    embeds: [
                        new Embed()
                            .setTitle("LFG Creation")
                            .setDescription(`Hi! It seems that you haven't set your timezone yet. This means that as a default, your timezone will be set to Europe/Helsinki
                            If that isn't correct, you can change your timezone using the command
                            </lfg timezone:1068987387121782895>`)
                    ],
                    components: [
                        new ActionRow()
                            .setComponents([
                                new Button()
                                    .setLabel("Next")
                                    .setStyle(ButtonStyle.Secondary)
                                    .setCustomId(`lfg-create-${activity}`)
                            ])
                    ],
                    ephemeral: true
                });
            } else {
                interaction.modal(
                    new Modal()
                        .setTitle("LFG Creation")
                        .setCustomId(`lfg-${activity}`)
                        .setComponents([
                            new ActionRow()
                                .setComponents([
                                    new TextInput()
                                        .setCustomId("lfg-size")
                                        .setLabel("Size of the fireteam")
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                        .setMinLength(1)
                                        .setMaxLength(2)
                                        .setPlaceholder("6")
                                ]),
                            new ActionRow()
                                .setComponents([
                                    new TextInput()
                                        .setCustomId("lfg-time")
                                        .setLabel("Time to start | (optional values)")
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                        .setMinLength(5)
                                        .setMaxLength(12)
                                        .setPlaceholder("HH:MM (DD.MM)")
                                ]),
                            new ActionRow()
                                .setComponents([
                                    new TextInput()
                                        .setCustomId("lfg-description")
                                        .setLabel("Description")
                                        .setStyle(TextInputStyle.Paragraph)
                                        .setRequired(true)
                                        .setPlaceholder("Chill cool raid, bring cookies :>")
                                ])
                        ])
                );
            }
        } else if(interaction.data.options[0].name === "timezone"){
            d2client.DB.set(interaction.member.user.id,interaction.data.options[0].options[0].value,"timezone");
            interaction.reply({content: `Saved timezone: ${interaction.data.options[0].options[0].value}`, ephemeral: true});
        } // Handle other commands here.
    }

    async btnRun(interaction, d2client){
        if(!(d2client.DB.has(interaction.member.user.id))) return interaction.reply({content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience.", ephemeral: true});
        const cmd = interaction.customId.split("-")[1];
        if(cmd === "create"){
            interaction.client.deleteWebhookMessage(interaction.applicationId, interaction.token, interaction.message.id).catch(() => {return true});
            interaction.modal(
                new Modal()
                    .setTitle("LFG Creation")
                    .setCustomId(`lfg-${interaction.customId.split("-")[2]}`)
                    .setComponents([
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-size")
                                    .setLabel("Size of the fireteam")
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMinLength(1)
                                    .setMaxLength(2)
                                    .setPlaceholder("6")
                            ]),
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-time")
                                    .setLabel("Time to start | (optional values)")
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMinLength(5)
                                    .setMaxLength(12)
                                    .setPlaceholder("HH:MM (DD.MM)")
                            ]),
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-description")
                                    .setLabel("Description")
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setRequired(true)
                                    .setPlaceholder("Chill cool raid, bring cookies :>")
                            ])
                    ])
            );
        } else if(cmd === "join"){
            // Join the LFG.
            const lfgid = interaction.customId.split("-")[2];
            const lfgemb = new Embed(interaction.message.embeds[0]);
            const guardians = lfgemb.fields![3];
            const queue = lfgemb.fields![4];
            let lfgData = d2client.lfgmanager.getLFG(lfgid);
            if(!lfgData) return interaction.reply({content: "No LFG found with the ID provided, please notify Administration.", ephemeral: true});
            const userID = interaction.member.user.id;
            if(lfgData.guardians.includes(userID) || lfgData.queue.includes(userID)) return interaction.reply({content: "You're already in this LFG.", ephemeral: true});
            await interaction.deferUpdate();
            const buttons = interaction.message.components[0].components.map(x => new Button(x));
            if(lfgData.guardians.length === parseInt(lfgData.maxSize)){
                lfgData.queue.push(userID);
                queue.value = lfgData.queue.map(x => d2client.DB.get(x).destinyName).join(", ");
                if(lfgData.guardians.length === lfgData.maxSize){
                    buttons[0].setLabel("Join in Queue");
                    buttons[0].setStyle(ButtonStyle.Primary);
                }
            } else {
                lfgData.guardians.push(userID);
                guardians.name = `**Guardians Joined: ${lfgData.guardians.length}/${lfgData.maxSize}**`;
                guardians.value = lfgData.guardians.map(x => d2client.DB.get(x).destinyName).join(", ");
                if(lfgData.guardians.length === parseInt(lfgData.maxSize)){
                    buttons[0].setLabel("Join in Queue");
                    buttons[0].setStyle(ButtonStyle.Primary);
                }
            }
            d2client.lfgmanager.saveLFG(lfgData);
            interaction.client.editWebhookMessage(interaction.applicationId,interaction.token,{
                embeds: [lfgemb],
                components: [new ActionRow().setComponents(buttons)]
            },lfgid.split("&")[1]);
        } else if(cmd === "leave"){
            // Leave the LFG.
            const lfgid = interaction.customId.split("-")[2];
            const lfgemb = new Embed(interaction.message.embeds[0]);
            const guardians = lfgemb.fields![3];
            const queue = lfgemb.fields![4];
            let lfgData = d2client.lfgmanager.getLFG(lfgid);
            if(!lfgData) return interaction.reply({content: "No LFG found with the ID provided, please notify Administration.", ephemeral: true});
            const userID = interaction.member.user.id;
            if(!(lfgData.guardians.includes(userID)) && !(lfgData.queue.includes(userID))) return interaction.reply({content: "You're not in this LFG.", ephemeral: true});
            await interaction.deferUpdate();
            const buttons = interaction.message.components[0].components.map(x => new Button(x));
            if(lfgData.queue.includes(userID)){
                lfgData.queue.splice(lfgData.queue.indexOf(userID),1);
                queue.value = lfgData.queue.length === 0 ? "None." : lfgData.queue.map(x => d2client.DB.get(x).destinyName).join(", ");
            } else {
                lfgData.guardians.splice(lfgData.guardians.indexOf(userID),1);
                if(lfgData.queue.length > 0){
                    lfgData.guardians.push(lfgData.queue.shift());
                    queue.value = lfgData.queue.map(x => d2client.DB.get(x).destinyName).join(", ");
                } else {
                    buttons[0].setLabel("Join")
                    buttons[0].setStyle(ButtonStyle.Success);
                    queue.value = "None.";
                }
                guardians.name = `**Guardians Joined: ${lfgData.guardians.length}/${lfgData.maxSize}**`;
                guardians.value = lfgData.guardians.length === 0 ? "None." : lfgData.guardians.map(x => d2client.DB.get(x).destinyName).join(", ");
            }
            d2client.lfgmanager.saveLFG(lfgData);
            interaction.client.editWebhookMessage(interaction.applicationId,interaction.token,{
                embeds: [lfgemb],
                components: [new ActionRow().setComponents(buttons)]
            },lfgid.split("&")[1]);
        } else if(cmd === "editOptions"){
            const creatorId = interaction.customId.split("-")[3]
            if (interaction.member.user.id === creatorId || interaction.member.permissions.has("MANAGE_MESSAGES")){ //created or has permissions to delete
                interaction.reply({
                    components: [
                        new ActionRow()
                            .addComponents([
                                new Button()
                                    .setCustomId(`lfg-delete-${interaction.customId.split("-")[2]}`)
                                    .setLabel("Delete")
                                    .setStyle(ButtonStyle.Danger)
                                ,
                                new Button()
                                    .setCustomId(`lfg-edit-${interaction.customId.split("-")[2]}`)
                                    .setLabel("Edit")
                                    .setStyle(ButtonStyle.Primary)
                            ])
                    ], ephemeral: true
                })
            }
            else {
                interaction.reply({
                    content: "You can't edit a post that isn't yours.", ephemeral: true
                })
            }
        } else if (cmd === "delete") {
            interaction.deferUpdate();
            const lfgid = interaction.customId.split("-")[2];
            d2client.lfgmanager.deleteLFG(lfgid);
            interaction.delete();
        } else if (cmd === "edit") {
            const lfgid = interaction.customId.split("-")[2];
            const oldLFG = d2client.lfgmanager.getLFG(lfgid);
            interaction.modal(
                new Modal()
                    .setTitle("LFG Editing")
                    .setCustomId(`lfg-${interaction.customId.split("-")[2]}-edit`)
                    .setComponents([
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-size")
                                    .setLabel("Size of the fireteam")
                                    .setStyle(TextInputStyle.Short)
                                    .setValue(oldLFG.maxSize ?? 6)
                                    .setRequired(true)
                                    .setMinLength(1)
                                    .setMaxLength(2)
                                    .setPlaceholder("6")
                            ]),
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-time")
                                    .setLabel("Time to start | (optional values)")
                                    .setStyle(TextInputStyle.Short)
                                    .setValue(oldLFG.timeString)
                                    .setRequired(true)
                                    .setMinLength(5)
                                    .setMaxLength(12)
                                    .setPlaceholder("HH:MM (DD.MM)")
                            ]),
                        new ActionRow()
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-description")
                                    .setLabel("Description")
                                    .setStyle(TextInputStyle.Paragraph)
                                    .setValue(oldLFG.desc ?? "")
                                    .setRequired(true)
                                    .setPlaceholder("Chill cool raid, bring cookies :>")
                            ])
                    ])
            );
            interaction.delete();
        }
    }

    async msRun(interaction, d2client){
        const data = interaction.data.components.map(x => x.components[0].value);
        let size = data[0]; let timeString = data[1]; let desc = data[2];
        if(isNaN(size) || parseInt(size) === 0) return;
        if(!(/^\d{2}:\d{2}($| \d{1,2}.\d{1,2})/gi.test(timeString))) return;
        const dbUser = d2client.DB.get(interaction.member.user.id);
        const name = dbUser.destinyName;
        const timezone = dbUser.timezone;
        let hour = parseInt(timeString.split(":")[0]); let minute = parseInt(timeString.split(":")[1].split(" ")[0]);
        let day: number | null = null; let month: number | null = null;
        if(timeString.split(" ").length === 2){
            day = parseInt(timeString.split(" ")[1].split(".")[0]);
            month = (parseInt(timeString.split(" ")[1].split(".")[1])-1);
        }
        let s = spacetime().goto(timezone).hour(hour).minute(minute).second(0).millisecond(0);
        if(day !== null && month !== null){
            s = s.date(day).month(month)
        }
        let time = Math.floor(s.epoch/1000);
        const embed = new Embed()
            .setFields([
                {name: "**Activity**", value: interaction.customId.split("-")[1], inline: true},
                {name: "**Start Time:**", value: `<t:${time}:F>
<t:${time}:R>`, inline: true},
                {name: "**Description:**", value: desc},
                {name: `**Guardians Joined: 1/${size}**`, value: name, inline: true},
                {name: "**Queue:**", value: "None.", inline: true}
            ]);
        if (interaction.customId.split("-")[2] === "edit") {
            interaction.deferUpdate();
            const oldLFG = d2client.lfgmanager.getLFG(interaction.customId.split("-")[1]);
            oldLFG.time = time; oldLFG.timeString = timeString; oldLFG.maxSize = size; oldLFG.desc = desc;
            d2client.lfgmanager.editLFG(oldLFG, embed);
            return;
        }
        interaction.reply({
            embeds: [embed]
        }).then(ic => {
            const id = `${ic.channelId}&${ic.message.id}`;
            ic.editReply({
                components: [
                    new ActionRow()
                        .setComponents([
                            new Button()
                                .setLabel(size === 1 ? "Join in Queue" : "Join")
                                .setStyle(size === 1 ? ButtonStyle.Primary : ButtonStyle.Success)
                                .setCustomId(`lfg-join-${id}`),
                            new Button()
                                .setLabel("Leave")
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId(`lfg-leave-${id}`),
                            new Button()
                                .setLabel("Edit")
                                .setStyle(ButtonStyle.Secondary)
                                .setCustomId(`lfg-editOptions-${id}-${ic.member.user.id}`)
                        ])
                ]
            });
            d2client.lfgmanager.saveLFG({
                id,
                activity: interaction.customId.split("-")[1],
                timeString,
                time,
                maxSize: size,
                creator: interaction.member.user.id,
                guardians: [interaction.member.user.id],
                queue: [],
                desc: desc
            });
        });
    }

    async acRun(interaction, d2client){
        const option = interaction.data.options[0];
        if(option.name === "create"){
            const currentOption = option.options[option.options.length - 1];
            if(currentOption.name === "type"){
                const types = ["Raid", "Dungeon", "Crucible", "Gambit", "Seasonal", "Other"];
                interaction.autocomplete(
                    types
                        .filter(x => x.toLowerCase().startsWith(currentOption.value.toLowerCase()))
                        .map(x => ({name: x, value: x}))
                );
            } else if(currentOption.name === "activity"){
                let activities;
                switch(option.options[0].value){
                    case "Raid":
                        activities = [];
                        let sunsetRaids = ["Leviathan", "Leviathan, Eater of Worlds", "Leviathan, Spire of Stars", "Scourge of the Past", "Crown of Sorrow"];
                        for (let [key, data] of d2client.activityIdentifierDB) {
                            if(data.type === 0 && !(sunsetRaids.includes(key))){
                                activities.push(key);
                            }
                        }
                        break;
                    case "Dungeon":
                        activities = [];
                        let sunsetDungeons = ["The Whisper", "Zero Hour", "Harbinger", "Presage"];
                        for (let [key, data] of d2client.activityIdentifierDB) {
                            if(data.type === 1 && !(sunsetDungeons.includes(key))){
                                activities.push(key);
                            }
                        }
                        break;
                    case "Crucible":
                        activities = ["Control","Competitive","Iron Banner","Trials of Osiris","Casual","Private Crucible Match","RNG Rumble"];
                        break;
                    case "Gambit":
                        activities = ["Gambit","Private Gambit Match"];
                        break;
                    case "Seasonal":
                        activities = ["Heist Battlegrounds","Ketchcrash","PsiOps"]
                        break;
                    case "Other":
                        activities = ["Grandmaster Nightfall","Wellspring","Dares of Eternity","Other"]
                        break;
                }
                interaction.autocomplete(
                    activities
                        .filter(x => x.toLowerCase().startsWith(currentOption.value.toLowerCase()))
                        .map(x => ({name: x, value: x}))
                );
            }
        } else if(option.name === "timezone"){
            const reply = timezones()
                .filter(x => x.toLowerCase().startsWith(option.options[0].value.toLowerCase()) || x.toLowerCase().split("/")[1].startsWith(option.options[0].value.toLowerCase()))
                .map(x => ({name: x, value: x}));
            if(reply.length > 25) reply.length = 25;
            interaction.autocomplete(reply);
        }
    }
}