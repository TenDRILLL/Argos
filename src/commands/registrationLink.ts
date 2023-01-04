import Command from "./Command";
import {ActionRow, Button, ButtonStyle} from "discord-http-interactions";

export default class RegistrationLink extends Command {
    constructor(){
        super("registrationlink");
    }

    async cmdRun(interaction, d2client){
        interaction.reply({
            content: "Sent.",
            ephemeral: true
        }).then(()=>{
            interaction.newMessage({
                content: "**To unlock Destiny channels and roles, register here.**",
                components: [
                    new ActionRow().setComponents([
                        new Button()
                            .setLabel("Register")
                            .setStyle(ButtonStyle.Link)
                            .setUrl("https://register.venerity.xyz/")
                    ])
                ]
            }).catch(e => console.log(e));
        });
    }
}