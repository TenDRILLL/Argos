import {APIResponse} from "../props/apiResponse";
import axios from "axios";
import {getRequest} from "../enums/requests";

export class requestHandler {
    private apiKey: string;

    constructor(apiKey){
        this.apiKey = apiKey;
    }

    async apiRequest(endpoint, data): Promise<APIResponse>{
        return new Promise((res,rej)=>{
            const request = getRequest(endpoint,data);
            if(!request) return rej("Invalid request.");
            axios.get(request,
                {
                    headers: {
                        "X-API-Key": this.apiKey,
                        "Content-Type": "application/x-www-form-urlencoded"
                    }
                })
                .then(d => {
                    res(d.data as APIResponse);
            }).catch(e => {
                rej(e.code);
            });
        });
    }

    async token(data){
        return new Promise((res)=>{
            axios.post(`https://www.bungie.net/platform/app/oauth/token`, data, {
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(d => {
                res(d.data);
            }).catch(e => {
                res(e.code);
            });
        });
    }
}