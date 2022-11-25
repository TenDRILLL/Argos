export async function registrationLink(interaction,dcclient){
    dcclient.interactionReply(interaction,{
        content: "Sent",
        flags: 64
    }).then(()=>{
        dcclient.followup(interaction,{
            content: "Test"
        });
    });
}