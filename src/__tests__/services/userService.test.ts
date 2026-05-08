import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));
const mockDbTransaction = mock(() => Promise.resolve());

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mockDbTransaction,
    initDatabase: mock(() => Promise.resolve())
}));

const mockApiRequest = mock(() => Promise.resolve({ Response: {}, ErrorCode: 1, ThrottleSeconds: 0 }));
const mockGetBungieTag = mock(() => Promise.resolve("Guardian#1234"));
const mockRefreshToken = mock(() => Promise.resolve({
    access_token: "new_access",
    expires_in: 3600,
    refresh_token: "new_refresh",
    refresh_expires_in: 7776000,
    membership_id: "987"
}));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: {
        apiRequest: mockApiRequest,
        getBungieTag: mockGetBungieTag,
        refreshToken: mockRefreshToken
    }
}));

const mockGetToken = mock(() => Promise.resolve("Bearer discord_token"));

mock.module("../../automata/DiscordTokenManager", () => ({
    getToken: mockGetToken,
    discordOauthExchange: mock(() => Promise.resolve({})),
    getDiscordInformation: mock(() => Promise.resolve({}))
}));

import { UserService } from "../../automata/UserService";
import { fixtureUser } from "../../__fixtures__/dbUser";

describe("UserService", () => {
    let service: UserService;

    beforeEach(() => {
        service = new UserService();
        mockDbQuery.mockClear();
        mockApiRequest.mockClear();
        mockGetBungieTag.mockClear();
    });

    describe("getDestinyName()", () => {
        it("returns destiny_name from DB", async () => {
            mockDbQuery.mockResolvedValueOnce([{ destiny_name: "Guardian#1234" }]);
            const name = await service.getDestinyName("123456789012345678");
            expect(name).toBe("Guardian#1234");
        });

        it("returns discordId as fallback when no row", async () => {
            mockDbQuery.mockResolvedValueOnce([]);
            const id = "unknown_user";
            const name = await service.getDestinyName(id);
            expect(name).toBe(id);
        });
    });

    describe("getAdminBungieToken()", () => {
        it("throws when admin not in user_tokens", async () => {
            mockDbQuery.mockResolvedValueOnce([]);
            await expect(service.getAdminBungieToken("admin_id")).rejects.toThrow("Admin not registered");
        });

        it("reads tokens, refreshes, saves back, returns access_token", async () => {
            const now = Date.now();
            mockDbQuery
                .mockResolvedValueOnce([{ refresh_token: "old_ref", refresh_expiry: now + 9999999 }])
                .mockResolvedValueOnce([]); // UPDATE call
            const token = await service.getAdminBungieToken("admin_id");
            expect(mockRefreshToken).toHaveBeenCalledWith("old_ref", now + 9999999);
            expect(token).toBe("new_access");
        });
    });

    describe("updateStats()", () => {
        const fakeCharResp = {
            characters: [{ characterId: "char1" }, { characterId: "char2" }],
            mergedAllCharacters: {
                results: { allPvP: { allTime: { killsDeathsRatio: { basic: { value: 1.5 } } } } },
                merged: { allTime: { highestLightLevel: { basic: { value: 1810 } } } }
            }
        };
        const fakeActivityResp = {
            activities: [
                { activityHash: 1661734046, values: { activityCompletions: { basic: { value: 5 } } } }
            ]
        };
        const fakeProfileResp = {
            profile: { data: { currentGuardianRank: 6 } }
        };

        beforeEach(() => {
            mockDbQuery
                .mockResolvedValueOnce([fixtureUser])              // SELECT user
                .mockResolvedValueOnce([]);                         // UPDATE users
            // All remaining dbQuery calls are INSERT user_activities
            mockDbQuery.mockResolvedValue([]);

            mockApiRequest
                .mockResolvedValueOnce({ Response: fakeProfileResp, ThrottleSeconds: 0, ErrorCode: 1 })  // getDestinyProfile
                .mockResolvedValueOnce({ Response: fakeCharResp, ThrottleSeconds: 0, ErrorCode: 1 })     // getDestinyCharacters
                .mockResolvedValue({ Response: fakeActivityResp, ThrottleSeconds: 0, ErrorCode: 1 });    // getActivityStats × chars
        });

        it("throws when user not in users table", async () => {
            mockDbQuery.mockReset();
            mockDbQuery.mockResolvedValueOnce([]);
            await expect(service.updateStats("nobody")).rejects.toThrow("No user");
        });

        it("writes kd, light, destiny_name, guardian_rank to users", async () => {
            await service.updateStats(fixtureUser.discord_id);
            const updateCall = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE users"));
            expect(updateCall).toBeDefined();
            expect(updateCall![1]).toContain(1810);   // light
            expect(updateCall![1]).toContain("Guardian#1234"); // destiny_name
            expect(updateCall![1]).toContain(6);     // guardian_rank
        });

        it("accumulates across all characters before writing (not just first)", async () => {
            const result = await service.updateStats(fixtureUser.discord_id);
            // Two characters both have hash 1661734046 → Last Wish. Total should be 5+5=10
            // (both chars return same fakeActivityResp with 5 clears)
            expect(result.raids["Last Wish"]).toBe(10);
        });

        it("returns UserStats with correct shape", async () => {
            const result = await service.updateStats(fixtureUser.discord_id);
            expect(result).toHaveProperty("discord_id");
            expect(result).toHaveProperty("bungie_id");
            expect(result).toHaveProperty("destiny_name");
            expect(result).toHaveProperty("stats");
            expect(result).toHaveProperty("raids");
            expect(result).toHaveProperty("dungeons");
            expect(result).toHaveProperty("grandmasters");
        });
    });

    describe("updateAllUserRoles()", () => {
        it("calls sleep(2) between batches, not sleep(index)", async () => {
            const sleepSpy = spyOn(service, "sleep");
            const fakeMembers = Array.from({ length: 25 }, (_, i) => ({ discord_id: `user_${i}` }));
            mockDbQuery.mockResolvedValueOnce(fakeMembers);
            // updateUserRoles will fail (no mock for full chain) — that's OK, we just check sleep
            const updateRolesSpy = spyOn(service, "updateUserRoles").mockResolvedValue(undefined);
            await service.updateAllUserRoles({} as any);
            // 25 users → 3 batches (0-9, 10-19, 20-24) → sleep called 2 times (between batches)
            const sleepArgs = sleepSpy.mock.calls.map((c: any[]) => c[0]);
            // All sleep calls must be 2, not i
            sleepArgs.forEach(s => expect(s).toBe(2));
        }, 10000);

        it("processes batches of 10", async () => {
            const fakeMembers = Array.from({ length: 15 }, (_, i) => ({ discord_id: `user_${i}` }));
            mockDbQuery.mockResolvedValueOnce(fakeMembers);
            const updateRolesSpy = spyOn(service, "updateUserRoles").mockResolvedValue(undefined);
            const sleepSpy = spyOn(service, "sleep").mockResolvedValue("" as any);
            await service.updateAllUserRoles({} as any);
            // 15 members → first batch 10, second batch 5 → sleep called once
            expect(sleepSpy).toHaveBeenCalledTimes(1);
            expect(updateRolesSpy).toHaveBeenCalledTimes(15);
        });
    });

    describe("updateClanMembers()", () => {
        it("uses BUNGIE_CLAN_ID env var", async () => {
            process.env.BUNGIE_CLAN_ID = "test_clan_id";
            mockApiRequest.mockResolvedValueOnce({
                Response: { results: [{ bungieNetUserInfo: { membershipId: "bungie_id_1" } }] },
                ThrottleSeconds: 0, ErrorCode: 1
            });
            mockDbQuery.mockResolvedValueOnce([]);
            await service.updateClanMembers();
            const apiCall = mockApiRequest.mock.calls[0];
            expect(apiCall[1].groupId).toBe("test_clan_id");
        });
    });
});
