import axios from "axios";
export class discordHandler {
    private apiKey: string;
    private discordID: string;
    private token: string;

    constructor(apiKey, discordId, token){
        this.apiKey = apiKey;
        this.discordID = discordId;
        this.token = token;
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
            }).catch(() => {
                console.log("reply Responding to an interaction failed.");
                res("");
            });
        });
    }

    newMessage(interaction,data){
        return new Promise(res => {
            axios.post(`https://discord.com/api/v10/channels/${interaction.channel_id}/messages`, data,{
                headers: {
                    "Authorization": `Bot ${this.token}`
                }
            }).then(()=>{
                res("");
            }).catch(()=>{
                console.log("newMessage creation failed.");
                res("");
            });
        });
    }

    editReply(interaction,data){
        axios.patch(`https://discord.com/api/v10/webhooks/${this.discordID}/${interaction.token}/messages/@original`,data).catch(() => {
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
            }).catch(() => {
                console.log("defer Responding to an interaction failed.");
                res("");
            });
        });
    }

    update(interaction,data){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,{
                type: 7,
                data
            }).then(()=>{
                res("");
            }).catch(() => {
                console.log("update Responding to an interaction failed.");
                res("");
            });
        });
    }

    delete(interaction){
        return new Promise(res=>{
            axios.post(`https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`, {
                type: 6
            }).then(()=>{
                axios.delete(`https://discord.com/api/v10/webhooks/${this.discordID}/${interaction.token}/messages/@original`).then(() => {
                    res("");
                }).catch(() => console.log("delete Deleting an interaction failed."));
            }).catch(() => console.log("delete Responding to an interaction failed."));
        });
    }

    getMember(guildID,userID){
        return new Promise(res => {
            axios.get(`https://discord.com/api/v10/guilds/${guildID}/members/${userID}`,{
                headers: {
                    "Authorization": `Bot ${this.token}`
                }
            }).then(d => {
                res(d.data);
            }).catch(e => console.log(e));
        });
    }

    setMember(guildID,userID,data){
        return new Promise(res => {
            axios.patch(`https://discord.com/api/v10/guilds/${guildID}/members/${userID}`, data, {
                headers: {
                    "Authorization": `Bot ${this.token}`
                }
            }).then(() => {
                res("");
            }).catch(e => console.log(e));
        });
    }
}