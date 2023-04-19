import { statRoles } from "../enums/statRoles";
import { BungieProfile } from "../props/bungieProfile";
import { LinkedProfileResponse } from "../props/linkedProfileResponse";
import { crypt } from "./crypt";

export function newRegistration(dcclient, d2client, dccode, d2code, res){
    d2client.discordTokens.discordOauthExchange(dccode).then(dcuser => {
        const data = new URLSearchParams();
        data.append("grant_type","authorization_code");
        data.append("code", d2code);
        data.append("client_id",d2client.clientID);
        data.append("client_secret",d2client.secret);
        d2client.token(data).then(x => {
            let id = x.membership_id;
            if(id){
                d2client.apiRequest("getBungieProfile",{id}).then(profile => {
                    const reply = profile.Response as BungieProfile;
                    let membershipType;
                    if(reply.steamDisplayName){membershipType = 3} else if(reply.xboxDisplayName){membershipType = 1} else if(reply.psnDisplayName){membershipType = 2} else if(reply.egsDisplayName){membershipType = 6} else {return;}
                    d2client.apiRequest("getBungieLinkedProfiles",{membershipType, membershipId: id}).then(resp => {
                        const reply2 = resp.Response as LinkedProfileResponse;
                        const primary = reply2.profiles.find(x => x.isCrossSavePrimary);
                        if(primary){
                            d2client.DB.set(dcuser.id,{
                                bungieId: id,
                                destinyId: primary.membershipId,
                                destinyName: reply.uniqueName,
                                membershipType: primary.membershipType,
                                tokens: {
                                    accessToken: x.access_token,
                                    accessExpiry: Date.now() + (x.expires_in*1000),
                                    refreshToken: x.refresh_token,
                                    refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                },
                                discordUser: dcuser
                            });
                            res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/api/panel");
                            dcclient.getMember(statRoles.guildID,dcuser.id).then(member => {
                                if(!member) return;
                                //@ts-ignore
                                if(member.roles.includes(statRoles.registeredID)) return;
                                //@ts-ignore
                                let roles = [...member.roles as string[], statRoles.registeredID];
                                //@ts-ignore
                                dcclient.setMember(statRoles.guildID,member.user.id,{roles}).catch(e => console.log(e));
                            });
                            d2client.dbUserUpdater.updateStatRolesUser(dcclient,d2client,dcuser.id);
                            return;
                        } else {
                            if(reply2.profiles.length === 1){
                                d2client.DB.set(dcuser.id,{
                                    bungieId: id,
                                    destinyId: reply2.profiles[0].membershipId,
                                    destinyName: reply.uniqueName,
                                    membershipType: reply2.profiles[0].membershipType,
                                    tokens: {
                                        accessToken: x.access_token,
                                        accessExpiry: Date.now() + (x.expires_in*1000),
                                        refreshToken: x.refresh_token,
                                        refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                    },
                                    discordUser: dcuser
                                });
                                res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/api/panel");
                                dcclient.getMember(statRoles.guildID,dcuser.id).then(member => {
                                    if(!member) return;
                                    //@ts-ignore
                                    if(member.roles.includes(statRoles.registeredID)) return;
                                    //@ts-ignore
                                    let roles = [...member.roles as string[], statRoles.registeredID];
                                    //@ts-ignore
                                    dcclient.setMember(statRoles.guildID,member.user.id,{roles}).catch(e => console.log(e));
                                });
                                d2client.dbUserUpdater.updateStatRolesUser(dcclient,d2client,dcuser.id);
                                return;
                            }
                            d2client.DB.set(dcuser.id,{
                                bungieId: id,
                                destinyName: reply.uniqueName,
                                tokens: {
                                    accessToken: x.access_token,
                                    accessExpiry: Date.now() + (x.expires_in*1000),
                                    refreshToken: x.refresh_token,
                                    refreshExpiry: Date.now() + (x.refresh_expires_in*1000)
                                },
                                discordUser: dcuser
                            });
                            const icons = ["", "https://cdn.discordapp.com/emojis/1045358581316321280.webp?size=96&quality=lossless",
                                            "https://cdn.discordapp.com/emojis/1057027325809672192.webp?size=96&quality=lossless", 
                                            "https://cdn.discordapp.com/emojis/1057041438816350349.webp?size=96&quality=lossless",
                                            "","",
                                            "https://cdn.discordapp.com/emojis/1057027818241916989.webp?size=96&quality=lossless"]
                            res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))})
                                .render('choosePlatform.ejs' ,{ profiles: reply2.profiles.sort(function (a,b) { return a.displayName.length - b.displayName.length}), icons: icons})    
                        }
                    }).catch(e => console.log(e));
                }).catch(e => console.log(e));
            } else {
                res.redirect(`/error?message=
                Destiny 2 oAuth2 Code Error. Please try again.
                                        
                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`);
            }
        }).catch(e => res.redirect(`/error?message=
            Destiny 2 oAuth2 Code Error. Please try again.
                                        
            \\n
            For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Shrieker`));
    }).catch(e => res.redirect(`/error?message=
                Faulty Discord oAuth Token Exchange. Please try again.
                            
                \\n
                For possible solutions, visit <a href="https://discord.venerity.xyz/">discord.venerity.xyz</a> and ask for help with the error code: Splicer
                &button=register`));
}