import axios from "axios";
import "dotenv/config";
import {RawInteraction, RawButtonInteractionData, RawCommandInteractionData, RawMember, RawMessage, RawUser} from "../props/discord";
import Command from "../commands/Command";
import {load} from "../commands/CommandLoader";
export class discordHandler {
    private discordID: string;
    private token: string;
    public commands: Map<string, Command>;

    constructor(){
        this.discordID = process.env.discordId as string;
        this.token = process.env.discordToken as string;
        this.loadCommands();
    }

    async loadCommands(){
        this.commands = await load();
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

export class Interaction {
    public id: string;
    public applicationId: string;
    public type: number;
    public guildId: string | null;
    public channelId: string | null;
    public member: RawMember | null;
    public user: RawUser | null;
    public token: string;
    public version: number;
    public appPermissions: string | null;
    public locale: string | null;
    public guildLocale: string | null;
    public data: RawCommandInteractionData | RawButtonInteractionData;
    public message: RawMessage | null;
    private discordID = process.env.discordId as string;
    private discordToken = process.env.discordToken as string;
    public client: discordHandler;


    constructor(raw: RawInteraction, dcclient: discordHandler) {
        this.id = raw.id;
        this.applicationId = raw.application_id;
        this.type = raw.type;
        this.guildId = raw.guild_id ?? null;
        this.channelId = raw.channel_id ?? null;
        this.member = raw.member ?? null;
        this.user = raw.user ?? null;
        this.token = raw.token;
        this.version = raw.version;
        this.appPermissions = raw.app_permissions ?? null;
        this.locale = raw.locale ?? null;
        this.guildLocale = raw.guild_locale ?? null;
        this.data = raw.data!;
        this.message = raw["message"] ?? null;
        this.client = dcclient;
    }

    reply(data){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${this.id}/${this.token}/callback`,{
                type: 4,
                data
            }).then(()=>{
                res("");
            }).catch(() => {
                console.log("reply Responding to an interaction failed.");
                res("");
            });
        });
    }

    newMessage(data){
        return new Promise(res => {
            axios.post(`https://discord.com/api/v10/channels/${this.channelId}/messages`, data,{
                headers: {
                    "Authorization": `Bot ${this.discordToken}`
                }
            }).then(()=>{
                res("");
            }).catch(()=>{
                console.log("newMessage creation failed.");
                res("");
            });
        });
    }

    editReply(data){
        axios.patch(`https://discord.com/api/v10/webhooks/${this.discordID}/${this.token}/messages/@original`,data).catch(() => {
            console.log("editreply Responding to an interaction failed.");
        });
    }

    defer(data = {}){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${this.id}/${this.token}/callback`,{
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

    update(data){
        return new Promise((res)=>{
            axios.post(`https://discord.com/api/v10/interactions/${this.id}/${this.token}/callback`,{
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

    delete(){
        return new Promise(res=>{
            axios.post(`https://discord.com/api/v10/interactions/${this.id}/${this.token}/callback`, {
                type: 6
            }).then(()=>{
                axios.delete(`https://discord.com/api/v10/webhooks/${this.discordID}/${this.token}/messages/@original`).then(() => {
                    res("");
                }).catch(() => console.log("delete Deleting an interaction failed."));
            }).catch(() => console.log("delete Responding to an interaction failed."));
        });
    }
}