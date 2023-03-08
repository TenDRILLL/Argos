import {statRoles} from "../enums/statRoles";
import { entityQuery } from "../props/entityQuery";
import { ManifestActivity, ManifestQuery, RawEntityQuery, RawManifestQuery } from "../props/manifest";
import { activityIdentifierObject } from "../props/activityIdentifierObject";
import { BungieGroupQuery, PendingClanmembersQuery } from "../props/bungieGroupQuery";
import { ActivityObject } from "../props/dbUser";
import { BungieProfile } from "../props/bungieProfile";
import { LinkedProfileResponse } from "../props/linkedProfileResponse";
import { URLSearchParams } from "url";
import { choosePlatformhtml } from "./htmlPages";
import { ActionRow, Button, ButtonStyle, Embed, Emoji } from "discord-http-interactions";
import axios from "axios";
import { CharacterQuery } from "../props/characterQuery";
import { socketComponents, vendorQuery } from "../props/vendorQuery";
import { WeaponSlot } from "../enums/weaponSlot";

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
                            updateStatRolesUser(dcclient,d2client,dcuser.id);
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
                                updateStatRolesUser(dcclient,d2client,dcuser.id);
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
                            const endResult = choosePlatformhtml(reply2.profiles.sort(function (a,b) { return a.displayName.length - b.displayName.length}))
                            res.cookie("conflux",crypt(process.env.argosIdPassword as string,dcuser.id),{expires: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000))})
                                .send(endResult);
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

export async function updateStatRoles(dcclient,d2client){
    const memberIds: string[] = Array.from(d2client.DB.keys());
    for (let i = 0; i < memberIds.length; i += 10) {
        await sleep(i);
        const ids: string[] = memberIds.slice(i, i + 10);
        ids.forEach(id => {
            updateStatRolesUser(dcclient,d2client,id);
        });
    }
}

export function updateStatRolesUser(dcclient,d2client,id){
    d2client.dbUserUpdater.updateStats(id).then(async (dbUser) => {
        if (!dbUser) {
            console.log(`NO DB USER FOR - ${id}`);
            return;
        }
        const discordAccessToken = await d2client.discordTokens.getToken(id)
            .catch(e => console.log(e));
        if(!discordAccessToken) return console.log(`${id} has no token, please ask them to re-register.`);
        let tempRaidObj = {};
        statRoles.raidNames.forEach(e => {
            tempRaidObj[e.toString()] = dbUser.raids[e.toString()]
        })
        let tempArr: string[] = [];
        let j;
        Object.keys(statRoles.raids).forEach((key) => { //kingsFall
            j = tempArr.length;
            Object.keys(statRoles.raids[key]).forEach(key2 => { //1
                if(tempRaidObj[key] >= key2){
                    tempArr[j] = statRoles.raids[key][key2];
                }
            });
        });
        j = tempArr.length;
        Object.keys(statRoles.kd).map(d => parseInt(d)).sort((a,b) => a-b ).forEach(key => {
            if(dbUser.stats.kd*10 >= key){
                tempArr[j] = statRoles.kd[key];
            }
        });
        j = tempArr.length;
        Object.keys(statRoles.lightLevel).map(d => parseInt(d)).sort((a,b) => a-b ).forEach(key => {
            if(dbUser.stats.light >= key){
                tempArr[j] = statRoles.lightLevel[key];
            }
        });
        j = tempArr.length;
        let clanMember = false;
        d2client.apiRequest("getGroupMembers", {groupId: "3506545" /*Venerity groupID*/}).then(d => {
            const resp = d.Response as BungieGroupQuery;
            if (resp.results.map(x => x.bungieNetUserInfo.membershipId).includes(dbUser.bungieId)) {
                clanMember = true;
            }
        }).catch(e => console.log(4));
        dcclient.getMember(statRoles.guildID,id).then(async member => {
            let data: { nick?: string, roles: string[] } = {
                roles: []
            };
            const d2name = await d2client.getBungieTag(dbUser.bungieId);
            if(!dbUser.destinyName || dbUser.destinyName !== d2name) dbUser.destinyName = d2name;
            d2client.DB.set(id,dbUser);
            const roles = member.roles.sort();
            data.roles = roles.filter(x => !statRoles.allIDs.includes(x));
            data.roles = [...data.roles, ...tempArr].sort();
            if(!(data.roles.length === roles.length && data.roles.every((role, i) => roles[i] === role))){
                dcclient.setMember(statRoles.guildID,id,data).catch(e => console.log(`Setting member ${id} failed.`));
            }
            axios.put(`https://discord.com/api/v10/users/@me/applications/${process.env.discordId}/role-connection`,
                {
                    platform_name: "Destiny 2",
                    platform_username: d2name,
                    metadata: {
                        clanmember: clanMember ? 1 : 0,
                        visitor: clanMember ? 0 : 1,
                        raids: dbUser.raids.Total,
                        dungeons: dbUser.dungeons.Total,
                        gms: dbUser.grandmasters.Total
                    }},{headers: {"Authorization": discordAccessToken, "Content-Type": "application/json"}}).catch(e => console.log(e));
        }).catch(e => {});//Member not on the server.
    });
}

export function fetchPendingClanRequests(dcclient, d2client) {
    d2client.refreshToken(d2client.adminuserID).then(d => {
        d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
            const resp = d.Response as PendingClanmembersQuery;
            const emojis = {1: "<:Xbox:1045358581316321280>", 2: "<:PlayStation:1057027325809672192>", 3: "<:Steam:1045354053087006800>", 6: "<:EpicGames:1048534129500770365>"};
            const handled = d2client.miscDB.get("handledApplications") ?? [];
            resp.results.forEach(async req => {
                if (!handled.includes(req.destinyUserInfo.membershipId)) {
                    const data = await d2client.dbUserUpdater.getPartialUserStats(
                        {
                            destinyId: req.destinyUserInfo.membershipId,
                            membershipType: req.destinyUserInfo.membershipType,
                        }
                        );
                    const embed = new Embed()
                        .setColor(0xae27ff)
                        .setTitle("A new clan request")
                        .setFields([
                            {"name": "User", "value": `${req.bungieNetUserInfo.supplementalDisplayName}`, "inline": true},
                            {"name": "Platforms", "value": `${req.destinyUserInfo.applicableMembershipTypes.map(y => emojis[y]).join(" ")}`, "inline": true},
                            {"name": "Power Level", "value": `${data.stats?.light ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Raid", "value": `${data.raids?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Dungeon", "value": `${data.dungeons?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Grandmaster", "value": `${data.grandmasters?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "PvP K/D", "value": `${Math.round((data.stats?.kd ?? 0) * 100)/100}`}
                        ])
                    const actionRows: ActionRow[] = [];
                    actionRows.push(
                        new ActionRow().setComponents([
                            new Button()
                                .setLabel("Approve")
                                .setStyle(ButtonStyle.Success)
                                .setCustomId(`clanrequest-approve-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`),
                            new Button()
                                .setLabel("Deny")
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId(`clanrequest-deny-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`)
                        ])
                    );
                    dcclient.newMessage("1048344159326572605",{
                        embeds: [embed],
                        components: actionRows
                    }).then(() => {
                        handled.push(req.destinyUserInfo.membershipId);
                        d2client.miscDB.set("handledApplications", handled);
                    });
                }
            })
        }).catch(e => console.log(e));
    });
}

export function sortActivities(activities: ActivityObject): Map<string, string[]> {
    const keys = Object.keys(activities);
    const sorted = Object.keys(activities).sort((a,b) => activities[b]-activities[a]).filter(a => !a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Heroic"))
    const size = sorted.filter(a => activities[a] !== 0 && (!a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Prestige"))).length;
    const ans: Map<string, string[]> = new Map();
    let i = 0
    while (i !== size) {
        if (ans[sorted[i]] == undefined) ans[sorted[i]] = [];
        ans[sorted[i]].push(activities[sorted[i]] as unknown as string)
        if (keys.includes(`${sorted[i]}, Master`)) {
            ans[sorted[i]].push(`Master`, activities[`${sorted[i]}, Master`]);
        }
        else if (keys.includes(`${sorted[i]}, Heroic`)) {
            ans[sorted[i]].push(`Heroic`, activities[`${sorted[i]}, Heroic`]);
        }
        else if (keys.includes(`${sorted[i]}, Prestige`)) {
            ans[sorted[i]].push(`Prestige`, activities[`${sorted[i]}, Prestige`]);
        }
        i += 1;
    }
    return ans;
}

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}

export function timezones(){
    return ["Africa/Asmera","Africa/Maputo","Africa/Lagos","Africa/Cairo","Africa/Casablanca","Africa/Ceuta","Africa/Abidjan","Africa/Nairobi","Africa/Johannesburg","Africa/Juba","Africa/Khartoum","Africa/Monrovia","Africa/Ndjamena","Africa/Tripoli","Africa/Tunis","Africa/Windhoek","America/Adak","America/Anchorage","America/Port_of_Spain","America/Araguaina","America/Bahia","America/Bahia_Banderas","America/Barbados","America/Belem","America/Belize","America/Boa_Vista","America/Bogota","America/Boise","America/Campo_Grande","America/Cancun","America/Caracas","America/Panama","America/Chihuahua","America/Costa_Rica","America/Cuiaba","America/Danmarkshavn","America/Edmonton","America/Eirunepe","America/El_Salvador","America/Tijuana","America/Fortaleza","America/Godthab","America/Grand_Turk","America/Guatemala","America/Halifax","America/Hermosillo","America/Jamaica","America/Juneau","America/Lima","America/Los_Angeles","America/Maceio","America/Managua","America/Manaus","America/Matamoros","America/Mazatlan","America/Merida","America/Metlakatla","America/Mexico_City","America/Monterrey","America/Montevideo","America/Toronto","America/Nassau","America/New_York","America/Nome","America/Noronha","America/Ojinaga","America/Phoenix","America/Port-au-Prince","America/Rio_Branco","America/Porto_Velho","America/Punta_Arenas","America/Recife","America/Regina","America/Santarem","America/Santiago","America/Santo_Domingo","America/Sao_Paulo","America/Scoresbysund","America/Sitka","America/St_Johns","America/Tegucigalpa","America/Thule","America/Vancouver","America/Whitehorse","America/Winnipeg","America/Yakutat","Antarctica/Casey","Antarctica/Davis","Antarctica/DumontDUrville","Antarctica/Macquarie","Antarctica/Mawson","Antarctica/McMurdo","Antarctica/Palmer","Antarctica/Rothera","Antarctica/South_Pole","Antarctica/Syowa","Antarctica/Troll","Antarctica/Vostok","Europe/Oslo","Asia/Riyadh","Asia/Almaty","Asia/Amman","Asia/Anadyr","Asia/Aqtau","Asia/Aqtobe","Asia/Ashgabat","Asia/Atyrau","Asia/Baghdad","Asia/Qatar","Asia/Baku","Asia/Bangkok","Asia/Barnaul","Asia/Beirut","Asia/Bishkek","Asia/Brunei","Asia/Kolkata","Asia/Chita","Asia/Choibalsan","Asia/Shanghai","Asia/Colombo","Asia/Dhaka","Asia/Damascus","Asia/Dili","Asia/Dubai","Asia/Dushanbe","Asia/Famagusta","Asia/Gaza","Asia/Hebron","Asia/Ho_Chi_Minh","Asia/Hong_Kong","Asia/Hovd","Asia/Irkutsk","Europe/Istanbul","Asia/Jakarta","Asia/Jayapura","Asia/Jerusalem","Asia/Kabul","Asia/Kamchatka","Asia/Karachi","Asia/Urumqi","Asia/Kathmandu","Asia/Khandyga","Asia/Krasnoyarsk","Asia/Kuala_Lumpur","Asia/Kuching","Asia/Macau","Asia/Magadan","Asia/Makassar","Asia/Manila","Asia/Nicosia","Asia/Novokuznetsk","Asia/Novosibirsk","Asia/Omsk","Asia/Oral","Asia/Pontianak","Asia/Pyongyang","Asia/Qostanay","Asia/Qyzylorda","Asia/Rangoon","Asia/Sakhalin","Asia/Samarkand","Asia/Seoul","Asia/Singapore","Asia/Srednekolymsk","Asia/Taipei","Asia/Tashkent","Asia/Tbilisi","Asia/Tehran","Asia/Thimphu","Asia/Tokyo","Asia/Tomsk","Asia/Ulaanbaatar","Asia/Ust-Nera","Asia/Vladivostok","Asia/Yakutsk","Asia/Yangon","Asia/Yekaterinburg","Asia/Yerevan","Atlantic/Azores","Atlantic/Bermuda","Atlantic/Canary","Atlantic/Cape_Verde","Atlantic/Faroe","Atlantic/Madeira","Atlantic/Reykjavik","Atlantic/South_Georgia","Atlantic/Stanley","Australia/Sydney","Australia/Adelaide","Australia/Brisbane","Australia/Broken_Hill","Australia/Currie","Australia/Darwin","Australia/Eucla","Australia/Hobart","Australia/Lord_Howe","Australia/Lindeman","Australia/Melbourne","Australia/Perth","Pacific/Easter","Europe/Dublin","Europe/Amsterdam","Europe/Andorra","Europe/Astrakhan","Europe/Athens","Europe/London","Europe/Belgrade","Europe/Berlin","Europe/Prague","Europe/Brussels","Europe/Bucharest","Europe/Budapest","Europe/Zurich","Europe/Chisinau","Europe/Copenhagen","Europe/Gibraltar","Europe/Helsinki","Europe/Kaliningrad","Europe/Kirov","Europe/Lisbon","Europe/Luxembourg","Europe/Madrid","Europe/Malta","Europe/Minsk","Europe/Monaco","Europe/Moscow","Europe/Paris","Europe/Riga","Europe/Rome","Europe/Samara","Europe/Saratov","Europe/Simferopol","Europe/Sofia","Europe/Stockholm","Europe/Tallinn","Europe/Tirane","Europe/Ulyanovsk","Europe/Uzhgorod","Europe/Vienna","Europe/Vilnius","Europe/Volgograd","Europe/Warsaw","Europe/Zaporozhye","Indian/Chagos","Indian/Christmas","Indian/Cocos","Indian/Kerguelen","Indian/Mahe","Indian/Maldives","Indian/Mauritius","Indian/Reunion","Pacific/Kwajalein","Pacific/Auckland","Pacific/Chatham","Pacific/Apia","Pacific/Bougainville","Pacific/Chuuk","Pacific/Efate","Pacific/Enderbury","Pacific/Fakaofo","Pacific/Fiji","Pacific/Funafuti","Pacific/Galapagos","Pacific/Gambier","Pacific/Guadalcanal","Pacific/Guam","Pacific/Honolulu","Pacific/Kanton","Pacific/Kiritimati","Pacific/Kosrae","Pacific/Majuro","Pacific/Marquesas","Pacific/Pago_Pago","Pacific/Nauru","Pacific/Niue","Pacific/Norfolk","Pacific/Noumea","Pacific/Palau","Pacific/Pitcairn","Pacific/Pohnpei","Pacific/Port_Moresby","Pacific/Rarotonga","Pacific/Tahiti","Pacific/Tarawa","Pacific/Tongatapu","Pacific/Wake","Pacific/Wallis","Asia/Kashgar"];
}

export function getWeaponInfo(d2client,weaponID): Promise<entityQuery> {
    return new Promise<entityQuery>(res => {
        if ((d2client.entityDB.has(weaponID))) {
            res(d2client.entityDB.get(weaponID));            
        } else {
            d2client.apiRequest("getEntity", {hashIdentifier: weaponID}).then(u => {
                const item = u.Response as entityQuery;
                d2client.entityDB.set(item.hash.toString(), item);
                res(item);
            }).catch(e => console.log(e));
        }
    });
}

export function normalizeActivityName(raidName) {
    const parts: string[] = raidName.split(":");
    return parts[0];
}

export function updateActivityIdentifierDB(d2client) {
    d2client.apiRequest("getManifests",{}).then(d => {
        const resp = d.Response as ManifestQuery;
        const enManifest = resp.jsonWorldComponentContentPaths.en["DestinyActivityDefinition"];
        const MasterTest = new RegExp(/Master/g);
        const PrestigeTest = new RegExp(/Prestige/g);
        const HeroicTest = new RegExp(/Heroic/g);
        d2client.rawRequest(`https://www.bungie.net${enManifest}`).then(e => {
            Object.values(e as unknown as RawManifestQuery).forEach(x => {
                const activity = x as ManifestActivity;      
                const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.name) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                if (MasterTest.test(activity.displayProperties.name)) { //Check if name contains Master
                    saved.difficultName = "Master";
                    saved.difficultIDs.push(activity.hash);
                    }
                else if (PrestigeTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Prestige";
                    saved.difficultIDs.push(activity.hash);
                }
                else if (HeroicTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Heroic";
                    saved.difficultIDs.push(activity.hash);
                }
                if (608898761/*dungeon*/ === activity.activityTypeHash) {
                    saved.type = 1;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved);
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            d2client.entityDB.set("activityOrder", temp);
                        }
                }
                } else if (2043403989/*raid*/ === activity.activityTypeHash) {
                    saved.type = 0;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved); 
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                } else if (new RegExp(/Grandmaster/gi).test(activity.displayProperties.name) && activity.displayProperties.description != "Grandmaster") {
                    const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.description) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                    saved.type = 2;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(activity.displayProperties.description, saved);
                        if (!d2client.entityDB.get("activityOrder").includes(activity.originalDisplayProperties.description)) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(activity.originalDisplayProperties.description);
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                }
            })
        });    
    }).catch(e => console.log(e));
}

export function getXurEmbed(d2client, dcclient): Promise<Embed> {
    const statHashes = ['2996146975', '392767087', '1943323491', '1735777505', '144602215', '4244567218']
    return new Promise((res, rej) => {
        d2client.refreshToken(d2client.adminuserID).then(q => {
            d2client.apiRequest("getDestinyCharacters", {
                membershipType: 3,
                destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
                    const resp = t.Response as CharacterQuery;
                    d2client.apiRequest("getVendorInformation", {
                        membershipType: 3,
                        destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
                        characterId: resp.characters.filter(character => !character.deleted)[0].characterId,
                        vendorHash: "2190858386" /*xur id*/},
                        {"Authorization": `Bearer ${q.tokens.accessToken}`}
                    ).then(async d => {
                        const info = d.Response as vendorQuery;
                        const location = info.vendor.data.vendorLocationIndex;
                        const data = info.categories.data.categories[0].itemIndexes.concat(info.categories.data.categories[1].itemIndexes).filter(e => e != 0).map(index => {
                            return {
                                itemHash: info.sales.data[index].itemHash,
                                sockets: info.itemComponents.sockets.data[index].sockets,
                                stats: statHashes.map(e => info.itemComponents.stats.data[index].stats[e]?.value)
                            };                  
                        })
                        await generateEmbed(data , d2client, location).then(embed => { res(embed) })
                    }).catch(e => {
                        console.log(`Xur isn't anywhere / something went wrong ${e}`)
                        rej("Xur isn't on any planet.")
                    });
            }).catch(e => rej(e))
    }).catch(() => console.log("Admin user not in DB"));
})
    
    function generateEmbed(components: {itemHash: number, sockets: socketComponents[], stats: number[]}[], d2client, locationIndex) {
        const promises: Promise<entityQuery>[] = [];
        components.forEach(item => {
            promises.push(new Promise((res)=>{
                getWeaponInfo(d2client, item.itemHash).then(d => {
                    res(d);
                    })
                })
            )})
        return Promise.all(promises).then(async data => {
            const xurLocations = ["Hangar, The Tower", "Winding Cove, EDZ", "Watcher’s Grave, Nessus"];
            return new Embed()
                .setTitle(`Xûr is at ${xurLocations[locationIndex]}`)
                .setColor(0xAE27FF)
                .setDescription("He is currently selling the following exotics")
                .setFields(await generateFields(data,components,3, dcclient))
        })
    }
    
    function generateFields(exotics: entityQuery[], components: {itemHash: number, sockets: socketComponents[], stats: number[] }[] , number: number, dcclient): Promise<{ name: string; value: string; inline?: boolean; }[]> {
        return new Promise(async (res)=>{
            const manifest = await d2client.apiRequest("getManifests",{});
            const path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyInventoryItemDefinition"];
            const InventoryItemDefinition = await d2client.rawRequest(`https://www.bungie.net${path}`) as RawEntityQuery;
            const classTypes: Map<number, string> = new Map([
                [3, ""],
                [1, "<:hunter2:1067375164012101642>"],
                [0, "<:titan2:1067375189421203486>"],
                [2, "<:warlock2:1067375209985880074>"]
            ]);
            const statEmojies = [
                "<:mobility:1068928862538440784>",
                "<:resilience:1068928804170514594>",
                "<:recovery:1068928541183455292>",
                "<:discipline:1068928610699841716>",
                "<:intellect:1068928723908313131>",
                "<:strength:1068928763884228728>"
            ]
            let rows: {name: string, value: string, inline?: boolean}[] = [];
            const exoticPromises: Promise<{name: string, value: string, inline?: boolean}>[] = [];
            exotics.forEach((exotic, i) => {
                const component = components.filter(e => e.itemHash === exotic.hash)[0];
                exoticPromises.push(new Promise(async (res) => {
                    const icons: any = []
                    let val = {"name": exotic.displayProperties.name, "value": `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}` , "inline": true}
                    icons.push(exotic.displayProperties)
                    if((WeaponSlot.weapons.includes(exotic.equippingBlock.equipmentSlotTypeHash))){
                        exotic.sockets.socketCategories[0].socketIndexes.forEach(e => {
                            const perkHash = component.sockets[e].plugHash
                            const perk = InventoryItemDefinition[perkHash]
                            if (!(perk.displayProperties.name.includes("Tracker"))) {
                                icons.push(perk.displayProperties)
                            }
                        });
                        exotic.sockets.socketCategories[1].socketIndexes.forEach(e => {
                            const perkHash = component.sockets[e].plugHash
                            const perk = InventoryItemDefinition[perkHash]
                            if (!(perk.displayProperties.name.includes("Tracker"))) {
                                icons.push(perk.displayProperties)
                            }
                        });
                    }
                    else {
                        val.value += "\n";
                        component.stats.forEach((e, i) => {
                            val.value += `${statEmojies[i]} ${e.toString().padEnd(3," ")}`;
                            if (i == 2) val.value += "\n";
                        })
                        val.value += `
Total: ${component.stats.reduce((a, b) => a+b)}`
                    }    
                    let iconNames: string[] = [];
                    for(let i = 0; i < icons.length; i++){
                        const emoji = await dcclient.findEmoji("990974785674674187", icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"));
                        if (emoji === null) {
                            const t: Emoji = await dcclient.createEmoji("990974785674674187", {name: icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"), url: `https://bungie.net${icons[i].icon}`})
                            if(t){
                                iconNames.push(t.toString());
                            }
                        } else {
                            iconNames.push(emoji.toString());
                        }
                    }
                    val.name = `${iconNames[0].toString()} ${val.name}`
                    iconNames.shift();
                    val.value += `
    ${iconNames.join(" ")}`;
                    res(val);
                }));
            });
            Promise.all(exoticPromises).then(data => {
                data.forEach((row,i)=>{
                    rows.push(row);
                });
                rows.sort((a,b) => a.value.length - b.value.length)
                rows = rows.map((e,i) => { if (i < 3) {e.value += "\n\u200b";} return e; })
                res(rows);
            })
        });
    }
}

const crypt = (salt, text) => {
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const byteHex = (n) => ("0" + Number(n).toString(16)).substr(-2);
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
    if(!salt || !text) return false;
    return text
        .split("")
        .map(textToChars)
        .map(applySaltToChar)
        .map(byteHex)
        .join("");
};

const decrypt = (salt, encoded) => {
    if(!salt || !encoded) return false;
    const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
    const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
    return encoded
        .match(/.{1,2}/g)
        .map((hex) => parseInt(hex, 16))
        .map(applySaltToChar)
        .map((charCode) => String.fromCharCode(charCode))
        .join("");
};

export {crypt, decrypt};