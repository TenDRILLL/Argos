import axios from "axios";
export class discordHandler {
    private apiKey: string;

    constructor(apiKey){
        this.apiKey = apiKey;
    }

    ping(res){
        return res.send({type: 1});
    }

    interactionReply(interaction,options){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,{
                type: 4,
                data: options
            }).then(()=>{
                res("");
            }).catch(e => {
                console.log("Responding to an interaction failed.");
                res("");
            });
        });
    }
}