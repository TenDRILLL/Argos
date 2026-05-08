import "dotenv/config";
import axios from "axios";
import {URLSearchParams} from "url";

import {ApiResponse, AuthenticationResponse} from "../structs/ApiResponse";
import {getRequest} from "../enums/requests";
import {BungieProfile} from "../structs/BungieProfile";

export class BungieAPI {
    private apiKey: string;
    private clientID: string;
    private secret: string;

    constructor(){
        this.apiKey = process.env.BUNGIE_API_KEY as string;
        this.clientID = process.env.BUNGIE_CLIENT_ID as string;
        this.secret = process.env.BUNGIE_SECRET as string;
    }

    async rawRequest(url): Promise<JSON>{
        return new Promise(res => {
            axios.get(url).then(d => res(d.data)).catch(e => console.log(e));
        });
    }

    async apiRequest(endpoint, data, headers?, method?, requestData?): Promise<ApiResponse>{
        return new Promise((res,rej)=>{
            const request = getRequest(endpoint,data);
            if(!request) return rej("Invalid request.");
            const config = {headers: {
                "X-API-Key": this.apiKey,
                "Content-Type": "application/x-www-form-urlencoded"
            }};
            if(headers){
                Object.keys(headers).forEach(headerName => {
                    config.headers[headerName] = headers[headerName];
                });
            }
            if(method){
                if(method === "post"){
                    axios.post(request, requestData, config)
                        .then(d => {
                            const response = d.data as ApiResponse;
                            if(response.ThrottleSeconds > 0){
                                setTimeout(()=>{
                                    res(this.apiRequest(endpoint,data,headers,method,requestData));
                                },response.ThrottleSeconds * 1000);
                            } else {
                                res(response);
                            }
                        }).catch(e => {
                            rej(`${e.code} ${e.response?.data?.Message !== undefined ? e.response.data.Message : ""}`);
                        });
                }
            } else {
                axios.get(request, config)
                    .then(d => {
                        const response = d.data as ApiResponse;
                        if(response.ThrottleSeconds > 0){
                            setTimeout(()=>{
                                res(this.apiRequest(endpoint,data));
                            },response.ThrottleSeconds * 1000);
                        } else {
                            res(response);
                        }
                    }).catch(e => {
                        console.log(e.response?.statusText);
                        rej(`${e.response.status} ${e.code} ${e.response?.data?.Message !== undefined ? e.response.data.Message : ""}`);
                    });
            }
        });
    }

    async token(data): Promise<AuthenticationResponse>{
        return new Promise((res, rej)=>{
            axios.post(`https://www.bungie.net/platform/app/oauth/token`, data, {
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(d => {
                res(d.data);
            }).catch(e => {
                rej(`${e.code} ${e.response?.data?.Message ?? ""}`);
            });
        });
    }

    async refreshToken(refreshTokenStr: string, refreshExpiry: number): Promise<AuthenticationResponse>{
        const data = new URLSearchParams();
        data.append("grant_type","refresh_token");
        data.append("refresh_token",refreshTokenStr);
        data.append("client_id",this.clientID);
        data.append("client_secret",this.secret);
        return new Promise((res,rej)=>{
            if(!refreshTokenStr) rej("No refresh token provided.");
            if(Date.now() - refreshExpiry >= 0) rej("Refresh token has expired.");
            axios.post(`https://www.bungie.net/platform/app/oauth/token`, data, {
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(d => {
                res(d.data);
            }).catch(e => {
                rej(`${e.code} ${e.response?.data?.Message !== undefined ? e.response.data.Message : ""}`);
            });
        });
    }

    async getBungieName(id): Promise<string>{
        return new Promise((res)=>{
            this.apiRequest("getBungieProfile",{id}).then(data => {
                const resp = data.Response as BungieProfile;
                res(resp.displayName);
            }).catch(e => console.log(e));
        });
    }

    async getBungieTag(id): Promise<string>{
        return new Promise((res)=>{
            this.apiRequest("getBungieProfile",{id}).then(data => {
                const resp = data.Response as BungieProfile;
                res(resp.uniqueName);
            }).catch(e => console.log(e));
        });
    }
}

export const bungieAPI = new BungieAPI();
