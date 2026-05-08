import axios from "axios";
import { Client } from "discord.js";

import { dbQuery } from "./Database";
import { bungieAPI } from "./BungieAPI";
import { getToken } from "./DiscordTokenManager";
import { statRoles } from "../enums/statRoles";
import { activityIdentifierDB } from "../enums/activityIdentifiers";
import { CharacterQuery } from "../structs/CharacterQuery";
import { ActivityQuery } from "../structs/ActivityQuery";
import { DestinyProfileQuery } from "../structs/DestinyProfileQuery";
import { BungieGroupQuery } from "../structs/BungieGroupQuery";
import { DBUser, ActivityObject, Stats, PartialDBUser, UserStats } from "../structs/DBUser";

export class UserService {

    async updateStats(discordId: string): Promise<UserStats> {
        const rows = await dbQuery("SELECT * FROM users WHERE discord_id = ?", [discordId]);
        if (rows.length < 1) throw new Error(`UpdateStats: No user with the ID ${discordId} found.`);
        const dbUser = rows[0] as DBUser;

        const profileData = await bungieAPI.apiRequest("getDestinyProfile", { membershipType: dbUser.membership_type, destinyMembershipId: dbUser.destiny_id });
        const profresp = profileData.Response as DestinyProfileQuery;

        const charData = await bungieAPI.apiRequest("getDestinyCharacters", { destinyMembershipId: dbUser.destiny_id, membershipType: dbUser.membership_type });
        const resp = charData.Response as CharacterQuery;

        const stats: Stats = {
            kd: resp.mergedAllCharacters.results.allPvP?.allTime?.killsDeathsRatio?.basic.value ?? 0,
            light: resp.mergedAllCharacters.merged.allTime.highestLightLevel.basic.value
        };

        const promises: Promise<Object>[] = [];
        resp.characters.forEach(character => {
            promises.push(new Promise((res) => {
                bungieAPI.apiRequest("getActivityStats", { destinyMembershipId: dbUser.destiny_id, membershipType: dbUser.membership_type, characterId: character.characterId }).then(d => {
                    const actResp = d.Response as ActivityQuery;
                    let activityIds = { 0: { "Total": 0 }, 1: { "Total": 0 }, 2: { "Total": 0 } };
                    for (const [key, data] of activityIdentifierDB) {
                        const IDs = data.IDs;
                        const type = data.type;
                        const difficultName = data.difficultName;
                        const difficultIDs = data.difficultIDs;
                        activityIds[type][key] = 0;
                        actResp.activities.forEach(a => {
                            if (IDs.includes(a.activityHash)) {
                                activityIds[type][key] += a.values.activityCompletions.basic.value;
                                activityIds[type]["Total"] += a.values.activityCompletions.basic.value;
                            }
                            if (difficultIDs.includes(a.activityHash)) {
                                if (activityIds[type][`${key}, ${difficultName}`]) {
                                    activityIds[type][`${key}, ${difficultName}`] += a.values.activityCompletions.basic.value;
                                } else {
                                    activityIds[type][`${key}, ${difficultName}`] = a.values.activityCompletions.basic.value;
                                }
                            }
                        });
                    }
                    res(activityIds);
                }).catch(e => console.log(`Activity stats fetch failed for character ${character.characterId}:`, e));
            }));
        });

        const data = await Promise.all(promises);
        const TotalClears = { 0: { "Total": 0 }, 1: { "Total": 0 }, 2: { "Total": 0 } };
        data.forEach(char => {
            Object.keys(char).forEach(type => {
                Object.keys(char[type]).forEach(key => {
                    if (TotalClears[type][key]) {
                        TotalClears[type][key] += char[type][key];
                    } else {
                        TotalClears[type][key] = char[type][key];
                    }
                });
            });
        });

        const destinyName = await bungieAPI.getBungieTag(dbUser.bungie_id);
        const guardianRank = profresp.profile.data.currentGuardianRank ?? 1;

        await dbQuery(
            "UPDATE users SET stats_kd=?, stats_light=?, destiny_name=?, guardian_rank=? WHERE discord_id=?",
            [stats.kd, stats.light, destinyName, guardianRank, discordId]
        );

        for (const typeIdx of [0, 1, 2] as const) {
            for (const [actKey, clears] of Object.entries(TotalClears[typeIdx])) {
                await dbQuery(
                    "INSERT INTO user_activities (discord_id, activity_key, activity_type, clears) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE clears=?",
                    [discordId, actKey, typeIdx, clears, clears]
                );
            }
        }

        return {
            discord_id: discordId,
            bungie_id: dbUser.bungie_id,
            destiny_name: destinyName,
            destiny_id: dbUser.destiny_id,
            membership_type: dbUser.membership_type,
            in_clan: dbUser.in_clan,
            guardian_rank: guardianRank,
            stats,
            raids: TotalClears[0] as ActivityObject,
            dungeons: TotalClears[1] as ActivityObject,
            grandmasters: TotalClears[2] as ActivityObject
        };
    }

    async getPartialUserStats(partialUser: { destinyId: string; membershipType: number }): Promise<PartialDBUser> {
        const charData = await bungieAPI.apiRequest("getDestinyCharacters", { destinyMembershipId: partialUser.destinyId, membershipType: partialUser.membershipType });
        const resp = charData.Response as CharacterQuery;
        const stats: Stats = {
            kd: resp.mergedAllCharacters.results.allPvP?.allTime?.killsDeathsRatio?.basic.value ?? 0,
            light: resp.mergedAllCharacters.merged.allTime.highestLightLevel.basic.value
        };
        const promises: Promise<Object>[] = [];
        resp.characters.forEach(character => {
            promises.push(new Promise((res) => {
                bungieAPI.apiRequest("getActivityStats", { destinyMembershipId: partialUser.destinyId, membershipType: partialUser.membershipType, characterId: character.characterId }).then(d => {
                    const actResp = d.Response as ActivityQuery;
                    let activityIds = { 0: { "Total": 0 }, 1: { "Total": 0 }, 2: { "Total": 0 } };
                    for (const [key, data] of activityIdentifierDB) {
                        const IDs = data.IDs;
                        const type = data.type;
                        const difficultName = data.difficultName;
                        const difficultIDs = data.difficultIDs;
                        activityIds[type][key] = 0;
                        actResp.activities.forEach(a => {
                            if (IDs.includes(a.activityHash)) {
                                activityIds[type][key] += a.values.activityCompletions.basic.value;
                                activityIds[type]["Total"] += a.values.activityCompletions.basic.value;
                            }
                            if (difficultIDs.includes(a.activityHash)) {
                                if (activityIds[type][`${key}, ${difficultName}`]) {
                                    activityIds[type][`${key}, ${difficultName}`] += a.values.activityCompletions.basic.value;
                                } else {
                                    activityIds[type][`${key}, ${difficultName}`] = a.values.activityCompletions.basic.value;
                                }
                            }
                        });
                    }
                    res(activityIds);
                }).catch(e => console.log(`Activity stats fetch failed for character ${character.characterId}:`, e));
            }));
        });
        const data = await Promise.all(promises);
        const TotalClears = { 0: { "Total": 0 }, 1: { "Total": 0 }, 2: { "Total": 0 } };
        data.forEach(char => {
            Object.keys(char).forEach(type => {
                Object.keys(char[type]).forEach(key => {
                    if (TotalClears[type][key]) {
                        TotalClears[type][key] += char[type][key];
                    } else {
                        TotalClears[type][key] = char[type][key];
                    }
                });
            });
        });
        return {
            destinyId: partialUser.destinyId,
            membershipType: partialUser.membershipType,
            stats,
            raids: TotalClears[0] as ActivityObject,
            dungeons: TotalClears[1] as ActivityObject,
            grandmasters: TotalClears[2] as ActivityObject
        };
    }

    async updateAllUserRoles(client: Client) {
        const rows = await dbQuery("SELECT discord_id FROM users WHERE destiny_id IS NOT NULL");
        const memberIds: string[] = rows.map((r: any) => r.discord_id);
        for (let i = 0; i < memberIds.length; i += 10) {
            if(i > 0) await this.sleep(2);
            const ids = memberIds.slice(i, i + 10);
            ids.forEach(id => { this.updateUserRoles(client, id).catch(e => console.log(`Role update failed for ${id}:`, e)); });
        }
    }

    async updateUserRoles(client: Client, id: string) {
        const dbUser = await this.updateStats(id).catch(e => { console.log(e); return null; });
        if (!dbUser) return console.log(`NO DB USER FOR - ${id}`);

        const discordAccessToken = await getToken(id).catch(e => { console.log(e); return null; });
        if (!discordAccessToken) return console.log(`${id} has no token, please ask them to re-register.`);

        const tempRaidObj: Record<string, number> = {};
        statRoles.raidNames.forEach(e => { tempRaidObj[e] = dbUser.raids[e] ?? 0; });

        let tempArr: string[] = [];
        let j: number;
        Object.keys(statRoles.raids).forEach(key => {
            j = tempArr.length;
            Object.keys(statRoles.raids[key]).forEach(key2 => {
                if (tempRaidObj[key] >= parseInt(key2)) tempArr[j] = statRoles.raids[key][key2];
            });
        });
        j = tempArr.length;
        Object.keys(statRoles.kd).map(d => parseInt(d)).sort((a, b) => a - b).forEach(key => {
            if (dbUser.stats.kd * 10 >= key) tempArr[j] = statRoles.kd[key];
        });
        j = tempArr.length;
        Object.keys(statRoles.lightLevel).map(d => parseInt(d)).sort((a, b) => a - b).forEach(key => {
            if (dbUser.stats.light >= key) tempArr[j] = statRoles.lightLevel[key];
        });

        const guild = client.guilds.cache.get(statRoles.guildID);
        if (!guild) return;
        const member = await guild.members.fetch(id).catch(() => null);
        if (!member) return;

        const d2name = await bungieAPI.getBungieTag(dbUser.bungie_id);
        if (!dbUser.destiny_name || dbUser.destiny_name !== d2name) {
            await dbQuery("UPDATE users SET destiny_name=? WHERE discord_id=?", [d2name, id]);
        }

        const currentRoles = Array.from(member.roles.cache.keys());
        let newRoles = currentRoles.filter(x => !statRoles.allIDs.includes(x));
        newRoles = [...newRoles, ...tempArr].sort();
        newRoles.push(dbUser.in_clan);

        if (!(newRoles.length === currentRoles.length && newRoles.every((role, i) => currentRoles[i] === role))) {
            await member.roles.set(newRoles).catch(() => console.log(`Setting member ${id} roles failed.`));
        }

        axios.put(
            `https://discord.com/api/v10/users/@me/applications/${process.env.DISCORD_ID}/role-connection`,
            {
                platform_name: "Destiny 2",
                platform_username: d2name,
                metadata: {
                    raids: dbUser.raids.Total,
                    dungeons: dbUser.dungeons.Total,
                    gms: dbUser.grandmasters.Total,
                    gr: dbUser.guardian_rank
                }
            },
            { headers: { "Authorization": discordAccessToken, "Content-Type": "application/json" } }
        ).catch(e => console.log(e));
    }

    sleep(seconds: number) {
        return new Promise(res => setTimeout(() => res(""), seconds * 1000));
    }

    async getDestinyName(discordId: string): Promise<string> {
        const rows = await dbQuery("SELECT destiny_name FROM users WHERE discord_id = ?", [discordId]);
        return rows[0]?.destiny_name ?? discordId;
    }

    async getAdminBungieToken(adminId: string): Promise<string> {
        const rows = await dbQuery("SELECT refresh_token, refresh_expiry FROM user_tokens WHERE discord_id = ?", [adminId]);
        if(!rows.length) throw new Error("Admin not registered.");
        const { refresh_token, refresh_expiry } = rows[0];
        const auth = await bungieAPI.refreshToken(refresh_token, Number(refresh_expiry));
        const now = Date.now();
        await dbQuery(
            "UPDATE user_tokens SET access_token=?, access_expiry=?, refresh_token=?, refresh_expiry=? WHERE discord_id=?",
            [auth.access_token, now + (auth.expires_in * 1000), auth.refresh_token, now + (auth.refresh_expires_in * 1000), adminId]
        );
        return auth.access_token;
    }

    async updateClanMembers() {
        const clanResp = await bungieAPI.apiRequest("getGroupMembers", { groupId: process.env.BUNGIE_CLAN_ID ?? "3506545" })
            .catch(e => { console.log(14); return null; });
        if (!clanResp) return;
        const resp = clanResp.Response as BungieGroupQuery ?? { results: [] };
        const ids = resp.results.map(x => x.bungieNetUserInfo.membershipId);
        if (ids.length > 0) {
            const users = await dbQuery("SELECT discord_id, bungie_id FROM users WHERE bungie_id IS NOT NULL");
            for (const user of users) {
                const inClan = ids.includes(user.bungie_id) ? statRoles.clanMember : statRoles.justVisiting;
                await dbQuery("UPDATE users SET in_clan=? WHERE discord_id=?", [inClan, user.discord_id]);
            }
        }
    }
}

export const userService = new UserService();
