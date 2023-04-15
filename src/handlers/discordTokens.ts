import Enmap from "enmap";
import axios from "axios";
import {URLSearchParams} from "url";

export default class DiscordTokens {
    private tokenDatabase;
    constructor() {
        this.tokenDatabase = new Enmap({name: "discord-tokens"});
    }

    public saveTokens(id, tokens){
        tokens.expires_at = Date.now() + (tokens.expires_in*1000);
        this.tokenDatabase.set(id, tokens);
    }

    public getToken(id): Promise<string>{
        return new Promise((res, rej)=>{
            if(!this.tokenDatabase.has(id)) rej(new Error(`USER_NOT_IN_DB: Requested user ${id} is not logged in the Database.`));
            let tokens: Tokens = this.tokenDatabase.get(id);
            if(Date.now() > tokens.expires_at!){
                const data = new URLSearchParams();
                data.append("client_id",process.env.discordId as string);
                data.append("client_secret",process.env.discordSecret as string);
                data.append("grant_type","refresh_token");
                data.append("refresh_token",tokens.refresh_token);
                axios.post("https://discord.com/api/oauth2/token",data,{headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).then(d => {
                    console.log(`${id} discord-token-refreshed.`);
                    const tokens: Tokens = d.data;
                    this.saveTokens(id, tokens);
                    res(`${tokens.token_type} ${tokens.access_token}`);
                }).catch(e => {rej(e.message);});
            } else {
                res(`${tokens.token_type} ${tokens.access_token}`);
            }
        });
    }

    public discordOauthExchange(code): Promise<dcuser>{
        return new Promise((res,rej)=>{
            const data = new URLSearchParams();
            data.append("client_id",process.env.discordId as string);
            data.append("client_secret",process.env.discordSecret as string);
            data.append("grant_type","authorization_code");
            data.append("code",code);
            data.append("redirect_uri","http://localhost:11542/oauth"); // https://api.venerity.xyz/oauth
            axios.post("https://discord.com/api/oauth2/token",data,{headers: {"Content-Type":"application/x-www-form-urlencoded"}}).then(x => {
                const tokens: Tokens = x.data;
                axios.get("https://discord.com/api/users/@me",{headers: {"authorization": `${tokens.token_type} ${tokens.access_token}`}}).then(y => {
                    const user: dcuser = y.data;
                    this.saveTokens(user.id, tokens);
                    res(user);
                }).catch(e => {console.log("Discord user information failed."); rej(e)});
            }).catch(e => {console.log("Discord token failed."); rej(e)});
        });
    }

    public getDiscordInformation(id):Promise<dcuser>{
        return new Promise(async (res,rej)=>{
            this.getToken(id).then(accessToken => {
                axios.get("https://discord.com/api/users/@me",{headers: {"authorization": accessToken}}).then(y => {
                    res(y.data);
                }).catch(e => {rej(e)});
            }).catch(e => rej(e));
        });
    }


}

class Tokens {
    access_token: string;
    expires_in: number;
    expires_at?: number;
    refresh_token: string;
    scope: string;
    token_type: string;
}

export class dcuser {
    id: string;
    username: string;
    avatar: string;
    avatar_decoration: string;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string;
    banner_color: string;
    accent_color: number;
    locale: string;
    mfa_enabled: boolean;
    premium_type: number;
}