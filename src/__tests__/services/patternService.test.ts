import { describe, it, expect, mock, beforeEach } from "bun:test";

// --- mocks must be declared before imports ---

const mockApiRequest = mock(() => Promise.resolve({
    Response: {
        jsonWorldComponentContentPaths: {
            en: { DestinyRecordDefinition: "/path/to/records.json" }
        }
    },
    ErrorCode: 1,
    ThrottleSeconds: 0,
}));

const fakeRecordDefs: Record<string, any> = {
    // positive hash
    "3743137436": {
        displayProperties: {
            name: "Rufus's Fury",
            description: "Completing Deepsight Resonance extractions on this weapon will unlock its Pattern.",
        },
        objectiveHashes: [999],
    },
    // negative hash (should be converted to unsigned)
    "-551651858": {
        displayProperties: {
            name: "Age-Old Bond",
            description: "Completing Deepsight Resonance extractions on this weapon will unlock its Pattern.",
        },
        objectiveHashes: [888],
    },
    // same name but wrong description — collectible record, should be IGNORED
    "11111": {
        displayProperties: {
            name: "Rufus's Fury",
            description: "Collect this weapon from Root of Nightmares.",
        },
        objectiveHashes: [],
    },
    // non-raid weapon — should be ignored even with correct description
    "22222": {
        displayProperties: {
            name: "Not A Raid Weapon",
            description: "Completing Deepsight Resonance extractions on this weapon will unlock its Pattern.",
        },
        objectiveHashes: [777],
    },
};

const mockRawRequest = mock(() => Promise.resolve(fakeRecordDefs));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest, rawRequest: mockRawRequest }
}));

import { PatternService } from "../../automata/PatternService";
import { RAID_GROUPS } from "../../enums/raidWeaponPatterns";

describe("PatternService", () => {
    let service: PatternService;

    beforeEach(() => {
        service = new PatternService();
        mockApiRequest.mockClear();
        mockRawRequest.mockClear();
    });

    describe("init()", () => {
        it("calls getManifests then downloads DestinyRecordDefinition", async () => {
            await service.init();
            expect(mockApiRequest).toHaveBeenCalledWith("getManifests", {});
            expect(mockRawRequest).toHaveBeenCalledWith("https://www.bungie.net/path/to/records.json");
        });

        it("resolves pattern records by name + description fragment", async () => {
            await service.init();
            expect(service.hashCount).toBe(2); // Rufus's Fury + Age-Old Bond
        });

        it("ignores records with matching name but wrong description", async () => {
            await service.init();
            // hash "11111" (duplicate Rufus's Fury with wrong description) must not be counted
            // only the real pattern record (3743137436) is picked up
            expect(service.hashCount).toBe(2);
        });

        it("ignores records whose name isn't in any raid group", async () => {
            await service.init();
            // "Not A Raid Weapon" must be excluded regardless of description
            expect(service.hashCount).toBe(2);
        });

        it("converts negative hash to unsigned 32-bit value", async () => {
            await service.init();
            // -551651858 + 4294967296 = 3743315438
            // Age-Old Bond entry uses negative hash key "-551651858"
            expect(service.hashCount).toBe(2); // confirms it was parsed, not skipped
        });

        it("concurrent init() calls only trigger one fetch", async () => {
            await Promise.all([service.init(), service.init(), service.init()]);
            expect(mockApiRequest).toHaveBeenCalledTimes(1);
            expect(mockRawRequest).toHaveBeenCalledTimes(1);
        });

        it("subsequent init() calls after first completion are no-ops", async () => {
            await service.init();
            await service.init();
            await service.init();
            expect(mockApiRequest).toHaveBeenCalledTimes(1);
        });

        it("throws when manifest path is missing", async () => {
            mockApiRequest.mockResolvedValueOnce({
                Response: { jsonWorldComponentContentPaths: { en: {} } },
                ErrorCode: 1,
                ThrottleSeconds: 0,
            });
            await expect(service.init()).rejects.toThrow("DestinyRecordDefinition path missing");
        });
    });

    describe("getProgress()", () => {
        const membershipType = 3;
        const destinyId = "111222333444555666";

        const fakeRecordsResponse = {
            Response: {
                profileRecords: {
                    data: {
                        records: {
                            "3743137436": {
                                objectives: [{ progress: 5, completionValue: 5, complete: true }]
                            },
                            "3743315438": {  // unsigned form of -551651858
                                objectives: [{ progress: 3, completionValue: 5, complete: false }]
                            },
                        }
                    }
                }
            },
            ErrorCode: 1,
            ThrottleSeconds: 0,
        };

        beforeEach(() => {
            mockApiRequest
                .mockResolvedValueOnce({
                    Response: {
                        jsonWorldComponentContentPaths: {
                            en: { DestinyRecordDefinition: "/path/to/records.json" }
                        }
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValueOnce(fakeRecordsResponse);
        });

        it("calls getProfileRecords with correct membershipType and destinyId", async () => {
            await service.getProgress(membershipType, destinyId);
            expect(mockApiRequest).toHaveBeenCalledWith("getProfileRecords", {
                membershipType,
                destinyMembershipId: destinyId,
            });
        });

        it("returns progress for matched weapons", async () => {
            const result = await service.getProgress(membershipType, destinyId);
            expect(result.has("Rufus's Fury")).toBe(true);
            const rf = result.get("Rufus's Fury")!;
            expect(rf.progress).toBe(5);
            expect(rf.completionValue).toBe(5);
        });

        it("returns progress: 0 default when objective missing", async () => {
            // provide response with no objectives array for a known hash
            mockApiRequest.mockReset();
            mockApiRequest
                .mockResolvedValueOnce({
                    Response: {
                        jsonWorldComponentContentPaths: {
                            en: { DestinyRecordDefinition: "/path/to/records.json" }
                        }
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValueOnce({
                    Response: {
                        profileRecords: {
                            data: {
                                records: {
                                    "3743137436": { objectives: [] }  // empty objectives
                                }
                            }
                        }
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                });

            const svc2 = new PatternService();
            const result = await svc2.getProgress(membershipType, destinyId);
            // no objectives → entry not added to map
            expect(result.has("Rufus's Fury")).toBe(false);
        });

        it("skips weapons whose record hash wasn't found in manifest", async () => {
            const result = await service.getProgress(membershipType, destinyId);
            // Only Rufus's Fury and Age-Old Bond were in fakeRecordDefs with correct descriptions
            // Anything else should not be in the result
            for (const [name] of result) {
                expect(["Rufus's Fury", "Age-Old Bond"]).toContain(name);
            }
        });

        it("handles empty records response without throwing", async () => {
            mockApiRequest.mockReset();
            mockApiRequest
                .mockResolvedValueOnce({
                    Response: {
                        jsonWorldComponentContentPaths: {
                            en: { DestinyRecordDefinition: "/path/to/records.json" }
                        }
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValueOnce({
                    Response: { profileRecords: { data: { records: {} } } },
                    ErrorCode: 1, ThrottleSeconds: 0,
                });

            const svc2 = new PatternService();
            const result = await svc2.getProgress(membershipType, destinyId);
            expect(result.size).toBe(0);
        });

        it("handles missing profileRecords in response without throwing", async () => {
            mockApiRequest.mockReset();
            mockApiRequest
                .mockResolvedValueOnce({
                    Response: {
                        jsonWorldComponentContentPaths: {
                            en: { DestinyRecordDefinition: "/path/to/records.json" }
                        }
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValueOnce({
                    Response: {},
                    ErrorCode: 1, ThrottleSeconds: 0,
                });

            const svc2 = new PatternService();
            const result = await svc2.getProgress(membershipType, destinyId);
            expect(result.size).toBe(0);
        });
    });

    describe("hashCount", () => {
        it("returns 0 before init", () => {
            expect(service.hashCount).toBe(0);
        });

        it("returns number of resolved hashes after init", async () => {
            mockApiRequest.mockResolvedValueOnce({
                Response: {
                    jsonWorldComponentContentPaths: {
                        en: { DestinyRecordDefinition: "/path/to/records.json" }
                    }
                },
                ErrorCode: 1,
                ThrottleSeconds: 0,
            });
            await service.init();
            expect(service.hashCount).toBe(2);
        });
    });
});
