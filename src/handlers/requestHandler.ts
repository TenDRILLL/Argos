import {APIResponse} from "../props/apiResponse";
import axios from "axios";
import {getRequest} from "../enums/requests";
import {URLSearchParams} from "url";
import {BungieProfile} from "../props/bungieProfile";
import {LinkedProfileResponse} from "../props/linkedProfileResponse";
import {DBUserUpdater} from "./dbUserUpdater";
import {statRoles} from "../enums/statRoles";

export class requestHandler {
    private apiKey: string;
    public dbUserUpdater: DBUserUpdater;

    constructor(apiKey,DB){
        this.apiKey = apiKey;
        this.dbUserUpdater = new DBUserUpdater(DB,this);
    }

    async rawRequest(url): Promise<JSON>{
        return new Promise(res => {
            axios.get(url).then(d => res(d.data)).catch(e => console.log(e));
        });
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
                    const response = d.data as APIResponse;
                    if(response.ThrottleSeconds > 0){
                        setTimeout(()=>{
                            res(this.apiRequest(endpoint,data));
                        },response.ThrottleSeconds * 1000);
                    } else {
                        res(response);
                    }
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

    async getBungieName(id){
        return new Promise((res)=>{
            this.apiRequest("getBungieProfile",{id}).then(data => {
                const resp = data.Response as BungieProfile;
                res(resp.displayName);
            });
        });
    }

    async getBungieTag(id){
        return new Promise((res)=>{
            this.apiRequest("getBungieProfile",{id}).then(data => {
                const resp = data.Response as BungieProfile;
                res(resp.uniqueName);
            });
        });
    }


    async handleRegistration(interaction,dcclient,clientID,DB){
        const emoji = ["", {name: "Xbox", id: "1045358581316321280", animated:false}, {name: "PlayStation", id: "1045354080794595339", animated:false}, {name: "Steam", id: "1045354053087006800", animated:false}];
        const style = ["",3,1,2];
        await interaction.defer({flags: 64});
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
                            interaction.editReply({
                                    content: "Registration successful!",
                                    flags: 64
                                }
                            );
                            if(interaction.member.roles.includes(statRoles.registeredID)) return;
                            let roles = [...interaction.member.roles, statRoles.registeredID];
                            dcclient.setMember(statRoles.guildID,interaction.member.user.id,{roles});
                            return;
                        } else {
                            if(reply.profiles.length === 1){
                                DB.set(discordID,{bungieId: id, destinyId: reply.profiles[0].membershipId, membershipType: reply.profiles[0].membershipType});
                                interaction.editReply({
                                        content: "Registration successful!",
                                        flags: 64
                                    }
                                );
                                if(interaction.member.roles.includes(statRoles.registeredID)) return;
                                let roles = [...interaction.member.roles, statRoles.registeredID];
                                dcclient.setMember(statRoles.guildID,interaction.member.user.id,{roles});
                                return;
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
                            interaction.editReply({
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
                interaction.editReply({
                        content: "Registration failed, please generate a new code.",
                        flags: 64
                    }
                );
            }
        });
    }
}