import "dotenv/config";
import {RawInteraction, RawButtonInteractionData, RawCommandInteractionData, RawMember, RawMessage, RawUser} from "../props/discord";
import Command from "../commands/Command";
import {load} from "../commands/CommandLoader";
import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v10";
import axios from "axios";
import {DBUser} from "../props/dbUser";

export class discordHandler {
    private discordID: string;
    private token: string;
    public commands: Map<string, Command>;
    public rest: REST;

    constructor(){
        this.discordID = process.env.discordId as string;
        this.token = process.env.discordToken as string;
        this.rest = new REST({version: "10"}).setToken(this.token);
        this.loadCommands();
    }

    async loadCommands(){
        this.commands = await load();
    }

    getMember(guildID,userID):Promise<unknown>{
        return new Promise(async (res,rej)=>{
            try {
                const member = await this.rest.get(Routes.guildMember(guildID,userID));
                res(member);
            } catch(e){
                rej(e);
            }
        });
    }

    setMember(guildID,userID,data){
        return new Promise(async (res,rej)=>{
            try {
                await this.rest.patch(Routes.guildMember(guildID,userID),{body: data});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    sendMessage(channelID, data) {
        return new Promise(async (res, rej) => {
            try {
                await this.rest.post(Routes.channelMessages(channelID),{body: data});
                res("");
            } catch(e) {
                rej(e);
            }
        })
    }

    refreshToken(d2client,dbUserID): Promise<DBUser> {
        return new Promise((res, rej) => {
            let dbUser = d2client.DB.get(dbUserID);
            if(dbUser === undefined || dbUser.discordTokens === undefined) return rej("No tokens!");
            const data = new URLSearchParams();
            data.append("client_id",process.env.discordId as string);
            data.append("client_secret",process.env.discordSecret as string);
            data.append("grant_type","refresh_token");
            data.append("refresh_token",dbUser.discordTokens.refreshToken);
            axios.post("https://discord.com/api/oauth2/token",data,{headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).then(d => {
                let dcdata = d.data;
                dbUser.discordTokens = {
                    accessToken: dcdata.access_token,
                    accessExpiry: Date.now() + (dcdata.expires_in*1000),
                    refreshToken: dcdata.refresh_token,
                    scope: dcdata.scope,
                    tokenType: dcdata.token_type
                };
                d2client.DB.set(dbUserID,dbUser);
                res(dbUser);
            }).catch(e => {rej(e.message);});
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
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.interactionCallback(this.id,this.token),{body: {type: 4, data}});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    newMessage(data){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.channelMessages(this.channelId!),{body: data});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    editReply(data){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.patch(Routes.webhookMessage(this.discordID,this.token,"@original"),{body: data});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    defer(data = {}){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.interactionCallback(this.id,this.token),{body: {type: 5, data}});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    update(data){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.interactionCallback(this.id,this.token), {body: {type: 7, data}});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    deferUpdate(){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.interactionCallback(this.id,this.token), {body: {type: 6}});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    delete(id?: string){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.delete(Routes.webhookMessage(this.discordID,this.token,id ?? "@original"));
                res("");
            } catch(e){
                rej(e);
            }
        });
    }

    autocomplete(data){
        return new Promise(async (res,rej)=>{
            try {
                await this.client.rest.post(Routes.interactionCallback(this.id,this.token),{body: {type: 8, data}});
                res("");
            } catch(e){
                rej(e);
            }
        });
    }
}