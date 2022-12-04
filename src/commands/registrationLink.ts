import Command from "./Command";

export default class RegistrationLink extends Command {
    constructor(){
        super("registrationlink");
    }

    async cmdRun(interaction, d2client){
        interaction.reply({
            content: "Sent.",
            flags: 64
        }).then(()=>{
            interaction.newMessage({
                content: "**To unlock Destiny channels and roles, register here.**",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                label: "Register",
                                style: 5,
                                url: "https://register.venerity.xyz/"
                            }
                        ]
                    }
                ]
            }).catch(e => console.log(e));
        });
    }
}