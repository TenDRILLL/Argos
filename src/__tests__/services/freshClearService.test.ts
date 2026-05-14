import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── mock Database ─────────────────────────────────────────────────────────────

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery:       mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase:  mock(() => Promise.resolve()),
}));

// ── mock BungieAPI ────────────────────────────────────────────────────────────

const mockApiRequest = mock(() => Promise.resolve({ Response: {}, ErrorCode: 1, ThrottleSeconds: 0 }));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest },
}));

// ── import after mocks ────────────────────────────────────────────────────────

import { FreshClearService } from "../../automata/FreshClearService";

// ── helpers ───────────────────────────────────────────────────────────────────

const NO_DELAY = { pageDelayMs: 0, userGapMs: 0 };

// Last Wish normal-mode hash — exists in activityIdentifierDB with type=0 (raid)
const LAST_WISH_HASH = 1661734046;
// Vault of Glass hash
const VOG_HASH = 1485585878;

const POST_WQ = "2022-03-01T00:00:00Z"; // after Feb 22 2022 epoch
const PRE_WQ  = "2021-01-01T00:00:00Z"; // before epoch

function flush(ms = 20): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function makeCharResp(charIds: string[]) {
    return { Response: { characters: charIds.map(id => ({ characterId: id })) }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function makeActivity(instanceId: string, referenceId: number, wasFresh: number, period = new Date().toISOString()) {
    return {
        activityDetails: { instanceId, referenceId },
        period,
        values: {
            completed:                      { basic: { value: 1 } },
            activityWasStartedFromBeginning: { basic: { value: wasFresh } },
        },
    };
}

function makeHistoryResp(instanceIds: string[], period = new Date().toISOString(), referenceId = LAST_WISH_HASH, wasFresh = 1) {
    return {
        Response: { activities: instanceIds.map(id => makeActivity(id, referenceId, wasFresh, period)) },
        ErrorCode: 1, ThrottleSeconds: 0,
    };
}

function makeEmptyHistoryResp() {
    return { Response: { activities: [] }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function makeAggregateResp(entries: [number, number][]) {
    return {
        Response: {
            activities: entries.map(([hash, count]) => ({
                activityHash: hash,
                values: { activityCompletions: { basic: { value: count } } },
            })),
        },
        ErrorCode: 1, ThrottleSeconds: 0,
    };
}

function makePGCRFreshResp() {
    return { Response: { activityWasStartedFromBeginning: true, startingPhaseIndex: 0 }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function makePGCRCheckpointResp() {
    return { Response: { activityWasStartedFromBeginning: false, startingPhaseIndex: 2 }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function makePGCRPreWqFreshResp() {
    // Pre-WQ: wasStartedFromBeginning is absent or defaulted false; use startingPhaseIndex=0
    return { Response: { startingPhaseIndex: 0 }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function makePGCRPreWqCheckpointResp() {
    // Pre-WQ checkpoint: startingPhaseIndex > 0
    return { Response: { startingPhaseIndex: 2 }, ErrorCode: 1, ThrottleSeconds: 0 };
}

function findSaveCalls(calls: any[][]): any[][] {
    return calls.filter(c => typeof c[0] === "string" && c[0].includes("INSERT INTO user_fresh_clears"));
}

function totalFreshSaved(calls: any[][]): number {
    return findSaveCalls(calls).reduce((sum, c) => sum + Number(c[1][2]), 0);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("FreshClearService", () => {
    beforeEach(() => {
        mockDbQuery.mockReset();
        mockApiRequest.mockReset();
    });

    // ── getCached() ───────────────────────────────────────────────────────────

    describe("getCached()", () => {
        it("returns null when no DB rows", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([]);
            expect(await svc.getCached("user1")).toBeNull();
        });

        it("returns FreshClearResult with counts Map", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([
                { activity_key: "Last Wish",      fresh_count: 42, last_updated: 1_700_000_000_000 },
                { activity_key: "Vault of Glass", fresh_count: 10, last_updated: 1_700_000_001_000 },
            ]);
            const result = await svc.getCached("user1");
            expect(result).not.toBeNull();
            expect(result!.counts.get("Last Wish")).toBe(42);
            expect(result!.counts.get("Vault of Glass")).toBe(10);
        });

        it("lastUpdated is the max across all activities", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([
                { activity_key: "Last Wish",      fresh_count: 5, last_updated: 1_000 },
                { activity_key: "Vault of Glass", fresh_count: 3, last_updated: 9_000 },
            ]);
            const result = await svc.getCached("user1");
            expect(result!.lastUpdated).toBe(9_000);
        });

        it("coerces string DB values to Number", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([
                { activity_key: "Last Wish", fresh_count: "99", last_updated: "1700000000000" }
            ]);
            const result = await svc.getCached("user1");
            expect(typeof result!.counts.get("Last Wish")).toBe("number");
            expect(typeof result!.lastUpdated).toBe("number");
        });
    });

    // ── isScanning() ──────────────────────────────────────────────────────────

    describe("isScanning()", () => {
        it("returns false before any scan", () => {
            expect(new FreshClearService(NO_DELAY).isScanning("user1")).toBe(false);
        });

        it("returns true while scan is in flight", async () => {
            const svc = new FreshClearService(NO_DELAY);
            let resolveChars!: (v: any) => void;
            mockApiRequest.mockReturnValueOnce(new Promise(res => { resolveChars = res; }));
            svc.startScan("user1", 3, "destiny1");
            expect(svc.isScanning("user1")).toBe(true);
            resolveChars(makeCharResp(["char1"]));
            mockApiRequest.mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);
            await flush();
        });

        it("returns false after scan completes", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest.mockResolvedValueOnce(makeCharResp(["char1"])).mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);
            svc.startScan("user1", 3, "destiny1");
            await flush();
            expect(svc.isScanning("user1")).toBe(false);
        });
    });

    // ── startScan() ───────────────────────────────────────────────────────────

    describe("startScan()", () => {
        it("ignores duplicate calls while scanning", async () => {
            const svc = new FreshClearService(NO_DELAY);
            let resolveChars!: (v: any) => void;
            mockApiRequest.mockReturnValueOnce(new Promise(res => { resolveChars = res; }));
            svc.startScan("user1", 3, "d1");
            svc.startScan("user1", 3, "d1");
            expect(mockApiRequest.mock.calls.length).toBe(1);
            resolveChars(makeCharResp(["char1"]));
            mockApiRequest.mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);
            await flush();
        });

        it("saves per-activity counts to DB on completion", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1"]))
                .mockResolvedValueOnce(makeHistoryResp(["inst1"], undefined, LAST_WISH_HASH, 1))
                .mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);

            svc.startScan("user1", 3, "d1");
            await flush();

            const saves = findSaveCalls(mockDbQuery.mock.calls);
            expect(saves.length).toBeGreaterThan(0);
            expect(saves.some(s => s[1][1] === "Last Wish")).toBe(true);
        });

        it("post-WQ activities: PGCR-confirmed checkpoints not counted", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1"]))
                .mockResolvedValueOnce({
                    Response: {
                        activities: [
                            makeActivity("cp",    LAST_WISH_HASH, 0, POST_WQ),
                            makeActivity("fresh", LAST_WISH_HASH, 1, POST_WQ),
                        ],
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValueOnce(makeEmptyHistoryResp())     // mode=82
                .mockResolvedValueOnce(makePGCRCheckpointResp())  // PGCR for "cp"
                .mockResolvedValueOnce(makePGCRFreshResp())       // PGCR for "fresh"
                .mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);

            svc.startScan("user1", 3, "d1");
            await flush();

            expect(totalFreshSaved(mockDbQuery.mock.calls)).toBe(1);
        });
    });

    // ── fresh detection ───────────────────────────────────────────────────────

    // All completions go through PGCR regardless of era.
    // Post-WQ: activityWasStartedFromBeginning is reliable (true/false).
    // Pre-WQ: activityWasStartedFromBeginning defaulted to false — ignore it, use startingPhaseIndex only.
    // PGCR unavailable (null) → default to fresh.
    describe("fresh detection", () => {
        // Call sequence: chars → mode=4 history → mode=82 history → PGCR
        async function countFresh(activity: any, pgcrResp?: any): Promise<number> {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockReset();
            mockApiRequest.mockReset();

            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1"]))
                .mockResolvedValueOnce({ Response: { activities: [activity] }, ErrorCode: 1, ThrottleSeconds: 0 })
                .mockResolvedValueOnce(makeEmptyHistoryResp())                    // mode=82 history
                .mockResolvedValueOnce(pgcrResp ?? makeEmptyHistoryResp());       // PGCR

            mockDbQuery.mockResolvedValue([]);

            svc.startScan("u", 3, "d");
            await flush();
            return totalFreshSaved(mockDbQuery.mock.calls);
        }

        it("post-WQ fresh (PGCR: activityWasStartedFromBeginning=true) → counted", async () => {
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 1, POST_WQ), makePGCRFreshResp())).toBe(1);
        });

        it("post-WQ checkpoint (PGCR: startingPhaseIndex=2) → not counted", async () => {
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 1, POST_WQ), makePGCRCheckpointResp())).toBe(0);
        });

        it("post-WQ checkpoint (PGCR: wasStarted=false, phase=0) → not counted", async () => {
            // wasStarted=false is an explicit 'not fresh' signal post-WQ even when phase=0
            const enc0Checkpoint = { Response: { activityWasStartedFromBeginning: false, startingPhaseIndex: 0 }, ErrorCode: 1, ThrottleSeconds: 0 };
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 1, POST_WQ), enc0Checkpoint)).toBe(0);
        });

        it("post-WQ when PGCR unavailable → defaults to fresh", async () => {
            const activity = {
                activityDetails: { instanceId: "i", referenceId: LAST_WISH_HASH },
                period: POST_WQ,
                values: { completed: { basic: { value: 1 } } },
            };
            expect(await countFresh(activity)).toBe(1);
        });

        it("pre-WQ fresh (PGCR: startingPhaseIndex=0) → counted", async () => {
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 0, PRE_WQ), makePGCRPreWqFreshResp())).toBe(1);
        });

        it("pre-WQ checkpoint (PGCR: startingPhaseIndex=2) → not counted", async () => {
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 0, PRE_WQ), makePGCRPreWqCheckpointResp())).toBe(0);
        });

        it("pre-WQ with wasStarted=false, phase=0 → counted (wasStarted unreliable pre-WQ)", async () => {
            // Pre-WQ PGCRs default wasStarted=false; we ignore it and use startingPhaseIndex=0 → fresh
            const oldPGCR = { Response: { activityWasStartedFromBeginning: false, startingPhaseIndex: 0 }, ErrorCode: 1, ThrottleSeconds: 0 };
            expect(await countFresh(makeActivity("i", LAST_WISH_HASH, 0, PRE_WQ), oldPGCR)).toBe(1);
        });

        it("completed=0 → not counted regardless of era", async () => {
            const activity = {
                activityDetails: { instanceId: "i", referenceId: LAST_WISH_HASH },
                period: PRE_WQ,
                values: { completed: { basic: { value: 0 } } },
            };
            expect(await countFresh(activity)).toBe(0);
        });

        it("unknown hash → not counted", async () => {
            expect(await countFresh(makeActivity("i", 99999999, 1, POST_WQ))).toBe(0);
        });
    });

    // ── per-activity grouping ─────────────────────────────────────────────────

    describe("per-activity grouping", () => {
        it("counts fresh separately per activity key", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1"]))
                .mockResolvedValueOnce({
                    Response: {
                        activities: [
                            makeActivity("lw1",  LAST_WISH_HASH, 1),
                            makeActivity("vog1", VOG_HASH,       1),
                        ],
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);

            svc.startScan("user1", 3, "d1");
            await flush();

            const saves  = findSaveCalls(mockDbQuery.mock.calls);
            const lwSave  = saves.find(s => s[1][1] === "Last Wish");
            const vogSave = saves.find(s => s[1][1] === "Vault of Glass");
            expect(lwSave?.[1][2]).toBe(1);
            expect(vogSave?.[1][2]).toBe(1);
        });

        it("ignores instances with unknown/GM hashes", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1"]))
                .mockResolvedValueOnce(makeHistoryResp(["gm_inst"], undefined, 99999999, 1))
                .mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);

            svc.startScan("user1", 3, "d1");
            await flush();

            expect(findSaveCalls(mockDbQuery.mock.calls).length).toBe(0);
        });
    });

    // ── deduplication ─────────────────────────────────────────────────────────

    describe("deduplication", () => {
        it("same instanceId across chars counted once", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["char1", "char2"]))
                .mockResolvedValueOnce(makeHistoryResp(["shared"], undefined, LAST_WISH_HASH, 1)) // char1 mode=4
                .mockResolvedValueOnce(makeEmptyHistoryResp())                                    // char1 mode=82
                .mockResolvedValueOnce(makeHistoryResp(["shared"], undefined, LAST_WISH_HASH, 1)) // char2 mode=4 dup
                .mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);

            svc.startScan("user1", 3, "d1");
            await flush();

            expect(totalFreshSaved(mockDbQuery.mock.calls)).toBe(1);
        });
    });

    // ── startInitialScanForAll() ──────────────────────────────────────────────

    describe("startInitialScanForAll()", () => {
        it("does nothing when all users already have data", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([]);
            svc.startInitialScanForAll();
            await flush();
            expect(mockApiRequest).not.toHaveBeenCalled();
        });

        it("uses fresh_scanned_at IS NULL to find unscanned users", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([{ discord_id: "u1", destiny_id: "d1", membership_type: 3 }]).mockResolvedValue([]);
            mockApiRequest.mockResolvedValueOnce(makeCharResp(["char1"])).mockResolvedValue(makeEmptyHistoryResp());
            svc.startInitialScanForAll();
            await flush();
            const q = mockDbQuery.mock.calls[0][0] as string;
            expect(q).toContain("fresh_scanned_at IS NULL");
        });

        it("scans each user exactly once", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery
                .mockResolvedValueOnce([
                    { discord_id: "u1", destiny_id: "d1", membership_type: 3 },
                    { discord_id: "u2", destiny_id: "d2", membership_type: 3 },
                ])
                .mockResolvedValue([]);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["c1"])) // getDestinyCharacters u1
                .mockResolvedValueOnce(makeEmptyHistoryResp()) // u1/c1 mode=4
                .mockResolvedValueOnce(makeEmptyHistoryResp()) // u1/c1 mode=82
                .mockResolvedValueOnce(makeCharResp(["c1"])) // getDestinyCharacters u2
                .mockResolvedValue(makeEmptyHistoryResp());   // u2 history
            svc.startInitialScanForAll();
            await flush();
            const charCalls = mockApiRequest.mock.calls.filter((c: any[]) => c[0] === "getDestinyCharacters");
            expect(charCalls.length).toBe(2);
        });

        it("ignores second call while batch is running", async () => {
            const svc = new FreshClearService(NO_DELAY);
            let resolveDb!: (v: any) => void;
            mockDbQuery.mockReturnValueOnce(new Promise(res => { resolveDb = res; }));
            svc.startInitialScanForAll();
            svc.startInitialScanForAll();
            expect(mockDbQuery.mock.calls.length).toBe(1);
            resolveDb([]);
            await flush();
        });
    });

    // ── startIncrementalUpdateAll() ───────────────────────────────────────────

    describe("startIncrementalUpdateAll()", () => {
        it("does nothing when no users have fresh clear data", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery.mockResolvedValueOnce([]);
            svc.startIncrementalUpdateAll();
            await flush();
            expect(mockApiRequest).not.toHaveBeenCalled();
        });

        it("uses GROUP BY + MAX(last_updated) to get per-user scan time", async () => {
            const svc = new FreshClearService(NO_DELAY);
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: "u1", destiny_id: "d1", membership_type: 3, last_updated: 1 }])
                .mockResolvedValue([]);
            mockApiRequest.mockResolvedValueOnce(makeCharResp(["c1"])).mockResolvedValue(makeEmptyHistoryResp());
            svc.startIncrementalUpdateAll();
            await flush();
            const q = mockDbQuery.mock.calls[0][0] as string;
            expect(q).toContain("MAX(fc.last_updated)");
            expect(q).toContain("GROUP BY");
        });

        it("stops paging when activity period <= lastUpdated", async () => {
            const svc = new FreshClearService(NO_DELAY);
            const lastUpdated = new Date("2024-01-15T12:00:00Z").getTime();
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: "u1", destiny_id: "d1", membership_type: 3, last_updated: lastUpdated }])
                .mockResolvedValueOnce([{ activity_key: "Last Wish", fresh_count: 0 }])
                .mockResolvedValue([]);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["c1"]))
                .mockResolvedValueOnce({
                    Response: {
                        activities: [
                            makeActivity("new", LAST_WISH_HASH, 1, "2024-01-20T10:00:00Z"),
                            makeActivity("old", LAST_WISH_HASH, 1, "2024-01-10T10:00:00Z"), // before lastUpdated
                        ],
                    },
                    ErrorCode: 1, ThrottleSeconds: 0,
                })
                .mockResolvedValue(makeEmptyHistoryResp());

            svc.startIncrementalUpdateAll();
            await flush();

            const saves  = findSaveCalls(mockDbQuery.mock.calls);
            const lwSave = saves.find(s => s[1][1] === "Last Wish");
            expect(lwSave?.[1][2]).toBe(1); // only "new" counted
        });

        it("adds new fresh count to existing count per activity", async () => {
            const svc = new FreshClearService(NO_DELAY);
            const lastUpdated = new Date("2024-01-15T12:00:00Z").getTime();
            mockDbQuery
                .mockResolvedValueOnce([{ discord_id: "u1", destiny_id: "d1", membership_type: 3, last_updated: lastUpdated }])
                .mockResolvedValueOnce([{ activity_key: "Last Wish", fresh_count: 10 }])
                .mockResolvedValue([]);
            mockApiRequest
                .mockResolvedValueOnce(makeCharResp(["c1"]))
                .mockResolvedValueOnce(makeHistoryResp(["new_inst"], "2024-01-20T10:00:00Z", LAST_WISH_HASH, 1))
                .mockResolvedValue(makeEmptyHistoryResp());

            svc.startIncrementalUpdateAll();
            await flush();

            const saves  = findSaveCalls(mockDbQuery.mock.calls);
            const lwSave = saves.find(s => s[1][1] === "Last Wish");
            expect(lwSave?.[1][2]).toBe(11); // 10 + 1
        });

        it("does not start second sweep while one is running", async () => {
            const svc = new FreshClearService(NO_DELAY);
            let resolve!: (v: any) => void;
            mockDbQuery.mockReturnValueOnce(new Promise(res => { resolve = res; }));
            svc.startIncrementalUpdateAll();
            svc.startIncrementalUpdateAll();
            expect(mockDbQuery.mock.calls.length).toBe(1);
            resolve([]);
            await flush();
        });

        it("skips users already in scanning set", async () => {
            const svc = new FreshClearService(NO_DELAY);
            let resolveChars!: (v: any) => void;
            mockApiRequest.mockReturnValueOnce(new Promise(res => { resolveChars = res; }));
            svc.startScan("user1", 3, "d1");

            mockDbQuery.mockResolvedValueOnce([
                { discord_id: "user1", destiny_id: "d1", membership_type: 3, last_updated: 1 },
            ]);
            svc.startIncrementalUpdateAll();
            await flush();

            const charCalls = mockApiRequest.mock.calls.filter((c: any[]) => c[0] === "getDestinyCharacters");
            expect(charCalls.length).toBe(1); // only from startScan, not incremental

            resolveChars(makeCharResp(["c1"]));
            mockApiRequest.mockResolvedValue(makeEmptyHistoryResp());
            mockDbQuery.mockResolvedValue([]);
            await flush();
        });
    });
});
