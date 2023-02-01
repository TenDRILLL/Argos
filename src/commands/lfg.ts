import Command from "./Command";
import {ActionRow, Button, ButtonStyle, Embed, Emoji, Modal, SelectMenuType, StringSelectMenu, TextInput, TextInputStyle} from "discord-http-interactions";
import { InteractionReplyData } from "discord-http-interactions/built/structures/InteractionReplyDataType";
import { SelectMenuComponent } from "discord-http-interactions/built/structures/SelectMenuComponent";
import { SelectMenuOption } from "discord-http-interactions/built/structures/SelectMenuOption";
import LFGManager from "../handlers/lfgManager";

export default class LFG extends Command {
    constructor(){
        super("lfg");
    }

    async cmdRun(interaction, d2client) {
        if(!(d2client.DB.has(interaction.member.user.id))) return interaction.reply({content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience."});
        if(interaction.data.options[0].name === "create"){
            const activity = interaction.data.options[0].options[1].value;
            interaction.reply({
                embeds: [
                    new Embed()
                        .setTitle("LFG Creation")
                        .setDescription(`Before you create an LFG, please go generate a timestamp to use for the LFG starting time.
                        
[You can get one from this link](https://www.unixtimestamp.com/)

Use your own local time, the site should convert it to the correct one automatically.
Once you have it, click the button to proceed with the creation.
*(This will be replaced with a Date Picker once Discord finally releases them.)*`)
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
        } else if(interaction.data.options[0].name === "timezone"){
            //TODO: Allow user to define their timezone, use autocomplete to supply options.
        } // Handle other commands here.
    }

    async btnRun(interaction, d2client){
        if(!(d2client.DB.has(interaction.member.user.id))) return interaction.reply({content: "Hi, you're not registered with me yet so unfortunately you can't use my functionality to the fullest :( Please register yourself at the earliest inconvenience."});
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
                                    .setMaxLength(1)
                                    .setPlaceholder("6")
                            ]),
                        new ActionRow() //TODO: Implement natural inputting of time, convert it later to UNIX with user defined timezone, use Finnish for default.
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-time")
                                    .setLabel("Timestamp when to start")
                                    .setStyle(TextInputStyle.Short)
                                    .setRequired(true)
                                    .setMinLength(10)
                                    .setMaxLength(10)
                                    .setPlaceholder(Date.now().toString())
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
                if(lfgData.guardians.length === lfgData.maxSize){
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
                    lfgData.guardians.push(lfgData.queue.pop());
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
                        new StringSelectMenu()
                            .setOptions([
                                new SelectMenuOption()
                                    .setLabel("Delete")
                                    //.setEmoji(new Emoji())
                                    .setDescription("Delete the lfg post")
                                    .setValue(`lfg-delete-${interaction.customId}`)
                                ,
                                new SelectMenuOption()
                                    .setLabel("Edit")
                                    .setDescription("Edit lfg")
                                    .setValue(`lfg-edit-${interaction.customId}`)
                            ])
                    ], ephemeral: true
                })
            }
            else {
                interaction.reply({
                    content: "You can't edit a post that isn't yours.", ephemeral: true
                })
            }
            // Edit the LFG.
            //TODO: Display a selection menu to display edits or delete.
            //d2client.lfgmanager.editLFG(id, embed);
        } else if (cmd === "delete") {
            const lfgid = interaction.customId.split("-")[2];
            d2client.lfgmanager.deleteLFG(lfgid);
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
                                    .setValue(oldLFG.maxSize ?? 0)
                                    .setRequired(true)
                                    .setMinLength(1)
                                    .setMaxLength(1)
                                    .setPlaceholder("6")
                            ]),
                        new ActionRow() //TODO: Implement natural inputting of time, convert it later to UNIX with user defined timezone, use Finnish for default.
                            .setComponents([
                                new TextInput()
                                    .setCustomId("lfg-time")
                                    .setLabel("Timestamp when to start")
                                    .setStyle(TextInputStyle.Short)
                                    .setValue(oldLFG.time ?? Date.now.toString())
                                    .setRequired(true)
                                    .setMinLength(10)
                                    .setMaxLength(10)
                                    .setPlaceholder(Date.now().toString())
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
        }
    }

    async msRun(interaction, d2client){
        const data = interaction.data.components.map(x => x.components[0].value);
        let size = data[0]; let time = data[1]; let desc = data[2];
        if(isNaN(size) || parseInt(size) === 0 || isNaN(time) || (parseInt(time)*1000) - Date.now() < 0) return;
        const name = d2client.DB.get(interaction.member.user.id).destinyName;
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
            const oldLFG = d2client.lfgmanager.getLFG(interaction.customId.split("-")[1]);
            return d2client.lfgmanager.editLFG(oldLFG, embed);
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
                time,
                maxSize: size,
                creator: interaction.member.user.id,
                guardians: [interaction.member.user.id],
                queue: []
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
        }
    }
}