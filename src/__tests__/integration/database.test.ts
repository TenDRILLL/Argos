import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { initDatabase, dbQuery, dbTransaction } from "../../automata/Database";

const dbAvailable = !!(process.env.ARGOS_RUN_INTEGRATION && process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS);

const maybeDescribe = dbAvailable ? describe : describe.skip;

maybeDescribe("Database integration", () => {
    beforeAll(async () => {
        await setupTestDb();
    });

    afterAll(async () => {
        await teardownTestDb();
    });

    it("initDatabase() creates all 7 tables", async () => {
        const tables = await dbQuery("SHOW TABLES");
        const names = tables.map((r: any) => Object.values(r)[0] as string);
        for (const t of ["users", "user_tokens", "user_activities", "lfg", "lfg_members", "misc", "discordToken"]) {
            expect(names).toContain(t);
        }
    });

    it("initDatabase() is idempotent (safe to run twice)", async () => {
        await expect(initDatabase()).resolves.toBeUndefined();
    });

    it("dbQuery() SELECT returns rows array", async () => {
        const result = await dbQuery("SELECT 1 AS val");
        expect(Array.isArray(result)).toBe(true);
        expect(result[0].val).toBe(1);
    });

    it("dbQuery() INSERT + SELECT round-trips correctly", async () => {
        await dbQuery(
            "REPLACE INTO users (discord_id, bungie_id) VALUES (?, ?)",
            ["test_db_user", "bungie_test"]
        );
        const rows = await dbQuery("SELECT discord_id, bungie_id FROM users WHERE discord_id = ?", ["test_db_user"]);
        expect(rows.length).toBe(1);
        expect(rows[0].discord_id).toBe("test_db_user");
        expect(rows[0].bungie_id).toBe("bungie_test");
    });

    it("dbQuery() with values array uses parameterized query (not literal)", async () => {
        // Ensures ? placeholders work — regression for the $1 bug
        const id = "param_test_user";
        await dbQuery("REPLACE INTO users (discord_id) VALUES (?)", [id]);
        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [id]);
        expect(rows[0].discord_id).toBe(id);
    });

    it("dbQuery() throws on SQL syntax error (does not swallow)", async () => {
        await expect(dbQuery("NOT VALID SQL!!!")).rejects.toBeDefined();
    });

    it("dbTransaction() commits all writes on success", async () => {
        await dbTransaction(async (tx) => {
            await tx("REPLACE INTO users (discord_id) VALUES (?)", ["txn_user"]);
        });
        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", ["txn_user"]);
        expect(rows.length).toBe(1);
    });

    it("dbTransaction() rolls back all writes when callback throws", async () => {
        const testId = "rollback_test_user";
        try {
            await dbTransaction(async (tx) => {
                await tx("REPLACE INTO users (discord_id) VALUES (?)", [testId]);
                throw new Error("intentional rollback");
            });
        } catch {}
        const rows = await dbQuery("SELECT discord_id FROM users WHERE discord_id = ?", [testId]);
        expect(rows.length).toBe(0);
    });

    it("concurrent dbQuery() calls work (pool handles them)", async () => {
        const queries = Array.from({ length: 5 }, (_, i) =>
            dbQuery("REPLACE INTO users (discord_id) VALUES (?)", [`concurrent_${i}`])
        );
        await expect(Promise.all(queries)).resolves.toBeDefined();
    });
});
