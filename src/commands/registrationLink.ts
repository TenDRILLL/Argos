export async function registrationLink(interaction,dcclient){
    dcclient.interactionReply(interaction,{
        content: "Sent.",
        flags: 64
    }).then(()=>{
        dcclient.newMessage(interaction,{
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