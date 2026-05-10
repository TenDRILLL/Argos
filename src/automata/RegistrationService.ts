import {Client} from "discord.js";
import {URLSearchParams} from "url";

import {bungieAPI} from "./BungieAPI";
import {dbQuery} from "./Database";
import {userService} from "./UserService";
import {discordOauthExchange} from "./DiscordTokenManager";
import {statRoles} from "../enums/statRoles";
import {BungieProfile} from "../structs/BungieProfile";
import {LinkedProfileResponse} from "../structs/LinkedProfileResponse";
import {crypt} from "../utils/crypt";
import {removeAccountRoles} from "../utils/removeAccountRoles";

export function newRegistration(client: Client, dccode: string, d2code: string, res): void {
    discordOauthExchange(dccode).then(dcuser => {
        const data = new URLSearchParams();
        data.append("grant_type","authorization_code");
        data.append("code", d2code);
        data.append("client_id",process.env.BUNGIE_CLIENT_ID as string);
        data.append("client_secret",process.env.BUNGIE_SECRET as string);
        bungieAPI.token(data).then(async x => {
            let id = x.membership_id;
            const existingUsers = await dbQuery("SELECT discord_id FROM users WHERE bungie_id = ?", [id]);
            if(existingUsers.length > 0){
                for(const existingUser of existingUsers) {
                    if(existingUser.discord_id !== dcuser.id){
                        await dbQuery("DELETE FROM user_activities WHERE discord_id = ?", [dcuser.id]);
                        await dbQuery("DELETE FROM user_tokens WHERE discord_id = ?", [dcuser.id]);
                        await dbQuery("DELETE FROM users WHERE discord_id = ?", [dcuser.id]);
                        removeAccountRoles(existingUser.discord_id, client);
                    }
                }
            }
            if(id){
                bungieAPI.apiRequest("getBungieProfile",{id}).then(profile => {
                    const reply = profile.Response as BungieProfile;
                    let membershipType;
                    if(reply.steamDisplayName){membershipType = 3} else if(reply.xboxDisplayName){membershipType = 1} else if(reply.psnDisplayName){membershipType = 2} else if(reply.egsDisplayName){membershipType = 6} else {return;}
                    bungieAPI.apiRequest("getBungieLinkedProfiles",{membershipType, membershipId: id}).then(async resp => {
                        const reply2 = resp.Response as LinkedProfileResponse;
                        const primary = reply2.profiles.find(x => x.isCrossSavePrimary);
                        if(primary){
                            await dbQuery(
                                "REPLACE INTO users (discord_id, bungie_id, destiny_id, destiny_name, membership_type) VALUES (?,?,?,?,?)",
                                [dcuser.id, id, primary.membershipId, reply.uniqueName, primary.membershipType]
                            );
                            await dbQuery(
                                "REPLACE INTO user_tokens (discord_id, access_token, access_expiry, refresh_token, refresh_expiry) VALUES (?,?,?,?,?)",
                                [dcuser.id, x.access_token, Date.now()+(x.expires_in*1000), x.refresh_token, Date.now()+(x.refresh_expires_in*1000)]
                            );
                            const conflux = await crypt(process.env.ARGOS_ID_PASSWORD as string,dcuser.id);
                            res.cookie("conflux",conflux,{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/panel");
                            const guild = client.guilds.cache.get(statRoles.guildID);
                            guild?.members.fetch(dcuser.id).then(member => {
                                if(!member) return;
                                if(member.roles.cache.has(statRoles.registeredID)) return;
                                const roles = [...Array.from(member.roles.cache.keys()), statRoles.registeredID];
                                member.roles.set(roles).catch(e => console.log(e));
                            });
                            userService.updateUserRoles(client, dcuser.id);
                            return;
                        } else {
                            if(reply2.profiles.length === 1){
                                await dbQuery(
                                    "REPLACE INTO users (discord_id, bungie_id, destiny_id, destiny_name, membership_type) VALUES (?,?,?,?,?)",
                                    [dcuser.id, id, reply2.profiles[0].membershipId, reply.uniqueName, reply2.profiles[0].membershipType]
                                );
                                await dbQuery(
                                    "REPLACE INTO user_tokens (discord_id, access_token, access_expiry, refresh_token, refresh_expiry) VALUES (?,?,?,?,?)",
                                    [dcuser.id, x.access_token, Date.now()+(x.expires_in*1000), x.refresh_token, Date.now()+(x.refresh_expires_in*1000)]
                                );
                                const conflux = await crypt(process.env.ARGOS_ID_PASSWORD as string,dcuser.id);
                                res.cookie("conflux",conflux,{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))}).redirect("/panel");
                                const guild = client.guilds.cache.get(statRoles.guildID);
                                guild?.members.fetch(dcuser.id).then(member => {
                                    if(!member) return;
                                    if(member.roles.cache.has(statRoles.registeredID)) return;
                                    const roles = [...Array.from(member.roles.cache.keys()), statRoles.registeredID];
                                    member.roles.set(roles).catch(e => console.log(e));
                                });
                                userService.updateUserRoles(client, dcuser.id);
                                return;
                            }
                            await dbQuery(
                                "REPLACE INTO users (discord_id, bungie_id, destiny_name) VALUES (?,?,?)",
                                [dcuser.id, id, reply.uniqueName]
                            );
                            await dbQuery(
                                "REPLACE INTO user_tokens (discord_id, access_token, access_expiry, refresh_token, refresh_expiry) VALUES (?,?,?,?,?)",
                                [dcuser.id, x.access_token, Date.now()+(x.expires_in*1000), x.refresh_token, Date.now()+(x.refresh_expires_in*1000)]
                            );
                            const icons = ["", "https://cdn.discordapp.com/emojis/1045358581316321280.webp?size=96&quality=lossless",
                                            "https://cdn.discordapp.com/emojis/1057027325809672192.webp?size=96&quality=lossless",
                                            "https://cdn.discordapp.com/emojis/1057041438816350349.webp?size=96&quality=lossless",
                                            "","",
                                            "https://cdn.discordapp.com/emojis/1057027818241916989.webp?size=96&quality=lossless"];
                            const sortedProfiles = reply2.profiles.sort((a,b) => a.displayName.length - b.displayName.length);
                            const links = await Promise.all(sortedProfiles.map(p => crypt(process.env.ARGOS_REGISTER_PASSWORD as string, `${p.membershipType}/seraph/${p.membershipId}`)));
                            const conflux = await crypt(process.env.ARGOS_ID_PASSWORD as string,dcuser.id);
                            res.cookie("conflux",conflux,{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))})
                                .render('choosePlatform.ejs', { platforms: sortedProfiles, icons: icons, links: links})
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
