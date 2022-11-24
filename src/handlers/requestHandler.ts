import {APIResponse} from "../props/apiResponse";
import axios from "axios";
import {getRequest} from "../enums/requests";
import {URLSearchParams} from "url";
import {BungieProfile} from "../props/bungieProfile";
import {LinkedProfileResponse} from "../props/linkedProfileResponse";

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

    async handleRegistration(interaction,dcclient,clientID,DB){
        const emoji = ["", {name: "Xbox", id: "1045358581316321280", animated:false}, {name: "PlayStation", id: "1045354080794595339", animated:false}, {name: "Steam", id: "1045354053087006800", animated:false}];
        const style = ["",3,1,2];
        await dcclient.defer(interaction,{flags: 64});
        const code = interaction.data.options[0].value;
        const discordID = interaction.member.user.id;
        const data = new URLSearchParams();
        data.append("grant_type","authorization_code");
        data.append("code", code);
        data.append("client_id",clientID);
        this.token(data).then(x => {
            //@ts-ignore
            let id = x.membership_id;
            if(id){
                this.apiRequest("getBungieProfile",{id}).then(profile => {
                    const reply = profile.Response as BungieProfile;
                    let membershipType;
                    if(reply.steamDisplayName){membershipType = 3} else if(reply.xboxDisplayName){membershipType = 1} else if(reply.psnDisplayName){membershipType = 2} else {return;}
                    this.apiRequest("getBungieLinkedProfiles",{membershipType, membershipId: id}).then(resp => {
                        const reply = resp.Response as LinkedProfileResponse;
                        const primary = reply.profiles.find(x => x.isCrossSavePrimary);
                        if(primary){
                            DB.set(discordID,{bungieId: id, destinyId: primary.membershipId, membershipType: primary.membershipType});
                            dcclient.editReply(interaction,
                                {
                                    content: "Registration successful!",
                                    flags: 64
                                }
                            );
                        } else {
                            if(reply.profiles.length === 1){
                                DB.set(discordID,{bungieId: id, destinyId: reply.profiles[0].membershipId, membershipType: reply.profiles[0].membershipType});
                                return dcclient.editReply(interaction,
                                    {
                                        content: "Registration successful!",
                                        flags: 64
                                    }
                                );
                            }
                            DB.set(discordID,{bungieId: id});
                            const buttons = reply.profiles.map(x => {
                                return {
                                    type: 2,
                                    label: x.displayName,
                                    style: style[x.membershipType],
                                    emoji: emoji[x.membershipType],
                                    custom_id: `${x.membershipId}-${x.membershipType}`
                                }
                            });
                            dcclient.editReply(interaction,
                                {
                                    content: "Please select your primary account/platform.",
                                    flags: 64,
                                    components: [
                                        {
                                            type: 1,
                                            components: buttons
                                        }
                                    ]
                                }
                            );
                        }
                    });
                });
            } else {
                dcclient.editReply(interaction,
                    {
                        content: "Registration failed, please generate a new code.",
                        flags: 64
                    }
                );
            }
        });
    }
}