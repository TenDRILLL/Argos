import axios from "axios";
export class discordHandler {
    private apiKey: string;
    private discordID: string;

    constructor(apiKey, discordId){
        this.apiKey = apiKey;
        this.discordID = discordId;
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
                console.log("reply Responding to an interaction failed.");
                res("");
            });
        });
    }

    editReply(interaction,data){
        axios.patch(`https://discord.com/api/v10/webhooks/${this.discordID}/${interaction.token}/messages/@original`,data).catch(e => {
            console.log("editreply Responding to an interaction failed.");
        });
    }

    defer(interaction,data){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,{
                type: 5,
                data
            }).then(()=>{
                res("");
            }).catch(e => {
                console.log("defer Responding to an interaction failed.");
                res("");
            });
        });
    }
}