import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";

const mockApiRequest = mock(async (endpoint: string) => {
    if (endpoint === "getDestinyCharacters") {
        return {
            Response: {
                characters: [{ characterId: "char1", deleted: false }],
                mergedAllCharacters: {
                    results: { allPvP: { allTime: { killsDeathsRatio: { basic: { value: 1.5 } } } } },
                    merged: { allTime: { highestLightLevel: { basic: { value: 1810 } } } }
                }
            },
            ThrottleSeconds: 0,
            ErrorCode: 1
        };
    }
    if (endpoint === "getDestinyInventory") {
        return { Response: {}, ThrottleSeconds: 0, ErrorCode: 1 };
    }
    if (endpoint === "getManifests") {
        return {
            Response: { jsonWorldComponentContentPaths: { en: { DestinyRecordDefinition: "/Destiny2/manifest/test" } } },
            ThrottleSeconds: 0,
            ErrorCode: 1
        };
    }
    return { Response: {}, ThrottleSeconds: 0, ErrorCode: 1 };
});

const mockRawRequest = mock(async () => ({}));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest, rawRequest: mockRawRequest }
}));

import { getPanelPageVariables } from "../../utils/getPanelPageVariables";
import type { UserStats } from "../../structs/DBUser";

const fakeStats: UserStats = {
    discord_id: "123456789012345678",
    bungie_id: "987654321098765432",
    destiny_name: "Guardian#1234",
    destiny_id: "111222333444555666",
    membership_type: 3,
    in_clan: "912643327189475378",
    guardian_rank: 6,
    stats: { kd: 1.23456, light: 1810 },
    raids: { "Total": 50, "Last Wish": 10 },
    dungeons: { "Total": 20, "Pit of Heresy": 5 },
    grandmasters: { "Total": 15, "The Glassway": 3 }
};

describe("getPanelPageVariables()", () => {
    it("returns correct field structure given UserStats", async () => {
        const result: any = await getPanelPageVariables("123456789012345678", fakeStats, { id: "123456789012345678", username: "testuser" });
        expect(result).toHaveProperty("DBData");
        expect(result).toHaveProperty("characters");
        expect(result).toHaveProperty("raids");
        expect(result).toHaveProperty("dungeons");
        expect(result).toHaveProperty("gms");
        expect(result).toHaveProperty("discordUser");
        expect(result).toHaveProperty("recordDefinitions");
        expect(result).toHaveProperty("classHashes");
    });

    it("handles null discord user (dcuser = null path)", async () => {
        const result: any = await getPanelPageVariables("123456789012345678", fakeStats, null);
        expect(result.discordUser).toBeNull();
    });

    it("DBData contains the passed-in stats", async () => {
        const result: any = await getPanelPageVariables("123456789012345678", fakeStats, null);
        expect(result.DBData.destiny_name).toBe("Guardian#1234");
        expect(result.DBData.stats.light).toBe(1810);
    });

    it("classHashes map contains all three classes", async () => {
        const result: any = await getPanelPageVariables("123456789012345678", fakeStats, null);
        expect(result.classHashes.get(671679327)).toBe("Hunter");
        expect(result.classHashes.get(3655393761)).toBe("Titan");
        expect(result.classHashes.get(2271682572)).toBe("Warlock");
    });
});
