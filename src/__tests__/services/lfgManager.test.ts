import { describe, it, expect, mock, beforeEach, spyOn } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));
const mockDbTransaction = mock(async (cb: (tx: any) => Promise<void>) => {
    const txMock = mock(() => Promise.resolve([]));
    await cb(txMock);
});

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mockDbTransaction,
    initDatabase: mock(() => Promise.resolve())
}));

const mockGetDestinyName = mock((id: string) => Promise.resolve(id));

mock.module("../../automata/UserService", () => ({
    userService: { getDestinyName: mockGetDestinyName }
}));

// safe-timers mock
mock.module("safe-timers", () => ({
    setTimeoutAt: (_fn: Function, _time: number) => ({ clear: mock(() => {}) })
}));

import { LFGManager } from "../../automata/LFGManager";
import { fixtureLFGPost } from "../../__fixtures__/lfgPost";
import { EmbedBuilder } from "discord.js";

describe("LFGManager", () => {
    let mgr: LFGManager;
    let fakeClient: any;

    beforeEach(() => {
        mgr = new LFGManager();
        fakeClient = {
            channels: { fetch: mock(() => Promise.resolve(null)) },
            users: { fetch: mock(() => Promise.reject()) },
            guilds: { cache: { get: mock(() => null) } }
        };
        mockDbQuery.mockClear();
        mockDbTransaction.mockClear();
    });

    describe("getLFG()", () => {
        it("returns null for unknown id", () => {
            expect(mgr.getLFG("nonexistent")).toBeNull();
        });
    });

    describe("saveLFG()", () => {
        it("stores post in memory map", () => {
            mgr.saveLFG({ ...fixtureLFGPost });
            expect(mgr.getLFG(fixtureLFGPost.id)).not.toBeNull();
        });

        it("calls _persistSave (DB write)", async () => {
            mgr.saveLFG({ ...fixtureLFGPost });
            await new Promise(r => setTimeout(r, 10));
            expect(mockDbTransaction).toHaveBeenCalled();
        });

        it("creates timer for new post", () => {
            mgr.init(fakeClient);
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const setTimeoutAt = require("safe-timers").setTimeoutAt;
            mgr.saveLFG({ ...fixtureLFGPost });
            // Timer creation is triggered — channel fetch fires
            expect(fakeClient.channels.fetch).toHaveBeenCalled();
        });
    });

    describe("deleteLFG()", () => {
        it("removes from memory map", () => {
            mgr.saveLFG({ ...fixtureLFGPost });
            mgr.deleteLFG(fixtureLFGPost.id);
            expect(mgr.getLFG(fixtureLFGPost.id)).toBeNull();
        });

        it("calls _persistDelete (DB write)", async () => {
            mgr.saveLFG({ ...fixtureLFGPost });
            mockDbQuery.mockClear();
            mgr.deleteLFG(fixtureLFGPost.id);
            await new Promise(r => setTimeout(r, 10));
            expect(mockDbQuery).toHaveBeenCalled();
            const deleteCall = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("DELETE FROM lfg"));
            expect(deleteCall).toBeDefined();
        });
    });

    describe("editLFG()", () => {
        it("moves guardians to queue when maxSize reduced", () => {
            const post = {
                ...fixtureLFGPost,
                maxSize: 6,
                guardians: ["a", "b", "c", "d"],
                queue: []
            };
            mgr.saveLFG(post);
            post.maxSize = 2;
            const embed = new EmbedBuilder();
            spyOn(mgr as any, "_doEditLFG").mockResolvedValue(undefined);
            mgr.editLFG(post, embed);
            expect(post.guardians.length).toBe(2);
            expect(post.queue.length).toBe(2);
        });

        it("moves queue to guardians when maxSize increased", () => {
            const post = {
                ...fixtureLFGPost,
                maxSize: 2,
                guardians: ["a", "b"],
                queue: ["c", "d"]
            };
            mgr.saveLFG(post);
            post.maxSize = 4;
            const embed = new EmbedBuilder();
            spyOn(mgr as any, "_doEditLFG").mockResolvedValue(undefined);
            mgr.editLFG(post, embed);
            expect(post.guardians.length).toBe(4);
            expect(post.queue.length).toBe(0);
        });
    });

    describe("createTimers()", () => {
        it("loads all lfg rows from DB on init", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{ id: fixtureLFGPost.id, activity: "Last Wish", scheduled: fixtureLFGPost.time, max_size: 6, creator: "creator1", description: "" }])
                .mockResolvedValueOnce([]); // lfg_members
            mgr.init(fakeClient);
            await new Promise(r => setTimeout(r, 20));
            expect(mockDbQuery).toHaveBeenCalledWith("SELECT * FROM lfg");
        });

        it("populates posts map from DB", async () => {
            mockDbQuery
                .mockResolvedValueOnce([{
                    id: fixtureLFGPost.id, activity: "Last Wish",
                    scheduled: fixtureLFGPost.time, max_size: 6, creator: "creator1", description: ""
                }])
                .mockResolvedValueOnce([{ discord_id: "guardian1", queued: false }]);
            spyOn(mgr as any, "_createTimer").mockImplementation(() => {});
            mgr.init(fakeClient);
            await new Promise(r => setTimeout(r, 20));
            const post = mgr.getLFG(fixtureLFGPost.id);
            expect(post).not.toBeNull();
            expect(post!.activity).toBe("Last Wish");
        });
    });

    describe("_persistSave() atomicity", () => {
        it("uses dbTransaction for atomic writes", async () => {
            mgr.saveLFG({ ...fixtureLFGPost });
            await new Promise(r => setTimeout(r, 10));
            expect(mockDbTransaction).toHaveBeenCalled();
        });
    });
});
