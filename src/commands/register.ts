import Command from "./Command";
import {statRoles} from "../enums/statRoles";

export default class Register extends Command {
    constructor(){
        super("register");
    }

    async cmdRun(interaction, d2client){
        return d2client.handleRegistration(interaction);
    }

    async btnRun(interaction, d2client){
        let dbUser = d2client.DB.get(interaction.member?.user?.id as string);
        dbUser["destinyId"] = interaction.data["custom_id"].split("-")[0];
        dbUser["membershipType"] = interaction.data["custom_id"].split("-")[1];
        d2client.DB.set(interaction.member?.user?.id as string,dbUser);
        interaction.update({
            content: "Registration successful!",
            components: [],
            flags: 64
        });
        if(interaction.member?.roles.includes(statRoles.registeredID)) return;
        let roles = [...interaction.member?.roles as string[], statRoles.registeredID];
        interaction.client.setMember(statRoles.guildID,interaction.member?.user?.id,{roles});
        return;
    }
}