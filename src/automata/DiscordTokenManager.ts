import axios from "axios";
import {URLSearchParams} from "url";
import { dbQuery } from "./Database";
import DiscordUser from "../structs/DiscordUser";
import DiscordTokens from "../structs/DiscordTokens";

function saveTokens(id: string, tokens: DiscordTokens){
    tokens.expires_at = Date.now() + (tokens.expires_in*1000);
    dbQuery(
        "REPLACE INTO discordToken (id, access_token, expires_in, expires_at, refresh_token, scope, token_type) VALUES (?,?,?,?,?,?,?)",
        [id,tokens.access_token,tokens.expires_in,tokens.expires_at,tokens.refresh_token,tokens.scope,tokens.token_type]
    );
}

function getToken(id: string): Promise<string>{
    return new Promise(async (res, rej)=>{
        let dbQ = await dbQuery("SELECT * FROM discordToken WHERE id = ?", [id]);
        if(dbQ.length < 1) return rej(new Error(`USER_NOT_IN_DB: Requested user ${id} is not logged in the Database.`));
        let tokens = dbQ[0] as DiscordTokens;

        if(Date.now() > Number(tokens.expires_at) - 60_000){
            const data = new URLSearchParams();
            data.append("client_id",process.env.DISCORD_ID as string);
            data.append("client_secret",process.env.DISCORD_SECRET as string);
            data.append("grant_type","refresh_token");
            data.append("refresh_token",tokens.refresh_token);

            axios.post("https://discord.com/api/oauth2/token",data,{headers: {"Content-Type": "application/x-www-form-urlencoded"}, timeout: 10_000}).then(d => {
                console.log(`${id} discord-token-refreshed.`);
                const tokens: DiscordTokens = d.data;
                saveTokens(id, tokens);
                res(`${tokens.token_type} ${tokens.access_token}`);
            }).catch(e => {rej(e.message);});
        } else {
            res(`${tokens.token_type} ${tokens.access_token}`);
        }
    });
}

function discordOauthExchange(code: string): Promise<DiscordUser>{
    return new Promise((res,rej)=>{
        const data = new URLSearchParams();
        data.append("client_id",process.env.DISCORD_ID as string);
        data.append("client_secret",process.env.DISCORD_SECRET as string);
        data.append("grant_type","authorization_code");
        data.append("code",code);
        data.append("redirect_uri",process.env.DISCORD_OAUTH as string);
        axios.post("https://discord.com/api/oauth2/token",data,{headers: {"Content-Type":"application/x-www-form-urlencoded"}, timeout: 10_000}).then(x => {
            const tokens: DiscordTokens = x.data;
            axios.get("https://discord.com/api/users/@me",{headers: {"authorization": `${tokens.token_type} ${tokens.access_token}`}}).then(y => {
                const user: DiscordUser = y.data;
                saveTokens(user.id, tokens);
                res(user);
            }).catch(e => {console.log("Discord user information failed."); rej(e)});
        }).catch(e => {console.log("Discord token failed."); rej(e)});
    });
}

function getDiscordInformation(id: string): Promise<DiscordUser>{
    return new Promise(async (res,rej)=>{
        getToken(id).then(accessToken => {
            axios.get("https://discord.com/api/users/@me",{headers: {"authorization": accessToken}}).then(y => {
                res(y.data as DiscordUser);
            }).catch(e => {rej(e)});
        }).catch(e => rej(e));
    });
}

export {getToken, discordOauthExchange, getDiscordInformation}