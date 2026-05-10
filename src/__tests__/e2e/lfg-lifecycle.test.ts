import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test";

// LFG lifecycle E2E — requires DB
const dbAvailable = !!(process.env.ARGOS_RUN_INTEGRATION && process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS);
const maybeDescribe = dbAvailable ? describe : describe.skip;

// mock safe-timers so we don't actually wait
mock.module("safe-timers", () => ({
    setTimeoutAt: (_fn: Function, _t: number) => ({ clear: () => {} })
}));

mock.module("../../automata/UserService", () => ({
    userService: { getDestinyName: (id: string) => Promise.resolve(id) }
}));

maybeDescribe("LFG lifecycle E2E", () => {
    let lfgId: string;
    let fakeClient: any;

    beforeAll(async () => {
        process.env.DB_NAME = "argos_test";
        const { initDatabase, dbQuery } = await import("../../automata/Database");
        await initDatabase();
        await dbQuery("SET FOREIGN_KEY_CHECKS = 0");
        for (const t of ["lfg", "lfg_members"]) {
            await dbQuery(`TRUNCATE TABLE ${t}`);
        }
        await dbQuery("SET FOREIGN_KEY_CHECKS = 1");

        fakeClient = {
            channels: { fetch: mock(() => Promise.resolve(null)) },
            users: { fetch: mock(() => Promise.reject()) }
        };
    });

    afterAll(async () => {
        const { dbQuery } = await import("../../automata/Database");
        await dbQuery("SET FOREIGN_KEY_CHECKS = 0");
        for (const t of ["lfg", "lfg_members"]) {
            await dbQuery(`TRUNCATE TABLE ${t}`);
        }
        await dbQuery("SET FOREIGN_KEY_CHECKS = 1");
    });

    it("saveLFG writes lfg row to DB", async () => {
        const { LFGManager } = await import("../../automata/LFGManager");
        const { dbQuery } = await import("../../automata/Database");
        const mgr = new LFGManager();
        mgr.init(fakeClient);
        lfgId = `test_channel_${Date.now()}&test_message_${Date.now()}`;
        mgr.saveLFG({
            id: lfgId,
            activity: "Last Wish",
            timeString: "Now",
            time: Math.floor(Date.now() / 1000) + 7200,
            maxSize: 6,
            creator: "creator1",
            guardians: ["creator1"],
            queue: [],
            desc: "E2E test"
        });
        await new Promise(r => setTimeout(r, 50));
        const rows = await dbQuery("SELECT * FROM lfg WHERE id = ?", [lfgId]);
        expect(rows.length).toBe(1);
        expect(rows[0].activity).toBe("Last Wish");
    });

    it("lfg_members row exists for creator", async () => {
        const { dbQuery } = await import("../../automata/Database");
        const rows = await dbQuery("SELECT * FROM lfg_members WHERE lfg_id = ?", [lfgId]);
        expect(rows.some((r: any) => r.discord_id === "creator1" && !r.queued)).toBe(true);
    });

    it("join adds guardian to lfg_members (via saveLFG)", async () => {
        const { LFGManager } = await import("../../automata/LFGManager");
        const { dbQuery } = await import("../../automata/Database");
        const mgr = new LFGManager();
        mgr.init(fakeClient);
        const post = {
            id: lfgId,
            activity: "Last Wish",
            timeString: "Now",
            time: Math.floor(Date.now() / 1000) + 7200,
            maxSize: 6,
            creator: "creator1",
            guardians: ["creator1", "joiner1"],
            queue: [],
            desc: "E2E test"
        };
        mgr.saveLFG(post);
        await new Promise(r => setTimeout(r, 50));
        const rows = await dbQuery("SELECT discord_id FROM lfg_members WHERE lfg_id = ? AND queued = 0", [lfgId]);
        const ids = rows.map((r: any) => r.discord_id);
        expect(ids).toContain("joiner1");
    });

    it("deleteLFG removes lfg and lfg_members rows", async () => {
        const { LFGManager } = await import("../../automata/LFGManager");
        const { dbQuery } = await import("../../automata/Database");
        const mgr = new LFGManager();
        mgr.init(fakeClient);
        mgr.deleteLFG(lfgId);
        await new Promise(r => setTimeout(r, 50));
        const lfg = await dbQuery("SELECT id FROM lfg WHERE id = ?", [lfgId]);
        const members = await dbQuery("SELECT lfg_id FROM lfg_members WHERE lfg_id = ?", [lfgId]);
        expect(lfg.length).toBe(0);
        expect(members.length).toBe(0);
    });

    it("createTimers() restores posts from DB into memory map", async () => {
        const { LFGManager } = await import("../../automata/LFGManager");
        const { dbQuery } = await import("../../automata/Database");
        const restoreId = `restore_ch&restore_msg`;
        const futureTime = Math.floor(Date.now() / 1000) + 7200;
        await dbQuery(
            "INSERT INTO lfg (id, activity, scheduled, max_size, creator) VALUES (?, ?, ?, ?, ?)",
            [restoreId, "Vault of Glass", futureTime, 6, "creator1"]
        );
        await dbQuery("INSERT INTO lfg_members (lfg_id, discord_id, queued) VALUES (?, ?, ?)", [restoreId, "creator1", false]);

        const mgr = new LFGManager();
        mgr.init(fakeClient);
        await new Promise(r => setTimeout(r, 50));
        const post = mgr.getLFG(restoreId);
        expect(post).not.toBeNull();
        expect(post!.activity).toBe("Vault of Glass");
        expect(post!.guardians).toContain("creator1");

        await dbQuery("DELETE FROM lfg WHERE id = ?", [restoreId]);
        await dbQuery("DELETE FROM lfg_members WHERE lfg_id = ?", [restoreId]);
    });
});
