import axios from "axios";
import {APIResponse} from "../props/apiResponse";

export class requestHandler {
    private apiKey: string;

    constructor(apiKey){
        this.apiKey = apiKey;
    }

    async apiRequest(endpoint): Promise<APIResponse>{
        return new Promise((res,rej)=>{
            axios.get(endpoint,
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
}