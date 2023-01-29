import Command from "./Command";
import {ActionRow, Button, ButtonStyle, Embed, Modal, TextInput, TextInputStyle} from "discord-http-interactions";

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
        } // Handle other commands here.
    }

    async btnRun(interaction, d2client){
        const cmd = interaction.customId.split("-")[1];
        if(cmd === "create"){
            interaction.client.deleteWebhookMessage(interaction.applicationId, interaction.token, interaction.message.id).catch(e => {return true});
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
                        new ActionRow()
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
        } else if(cmd === "leave"){
            // Leave the LFG.
        } else if(cmd === "edit"){
            // Edit the LFG.
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
        interaction.reply({
            embeds: [embed],
            components: [
                new ActionRow()
                    .setComponents([
                        new Button()
                            .setLabel(size === 1 ? "Join in Queue" : "Join")
                            .setStyle(size === 1 ? ButtonStyle.Primary : ButtonStyle.Success)
                            .setCustomId(`lfg-join-id`),
                        new Button()
                            .setLabel("Leave")
                            .setStyle(ButtonStyle.Danger)
                            .setCustomId(`lfg-leave-id`),
                        new Button()
                            .setLabel("Edit")
                            .setStyle(ButtonStyle.Secondary)
                            .setCustomId(`lfg-edit-id-userid`)
                    ])
            ],
            ephemeral: true
        });
        // Edit the message, with components after sending, include id in custom_id.
        // Add the LFG to the DB.
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