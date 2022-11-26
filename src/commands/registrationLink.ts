import { Interaction } from "../handlers/discordHandler";

export async function registrationLink(interaction: Interaction){
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
        });
    });
}