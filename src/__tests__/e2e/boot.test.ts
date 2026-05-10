import { describe, it, expect, beforeAll, afterAll } from "bun:test";

// E2E smoke test: boot sequence
// Requires: DB_HOST, DB_USER, DB_PASS set, mock Discord login

const dbAvailable = !!(process.env.ARGOS_RUN_INTEGRATION && process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS);
const maybeDescribe = dbAvailable ? describe : describe.skip;

maybeDescribe("Boot sequence E2E", () => {
    beforeAll(() => {
        process.env.DB_NAME = "argos_test";
        process.env.WEB_PORT = "19876";
    });

    it("initDatabase() creates all 7 tables", async () => {
        const { initDatabase, dbQuery } = await import("../../automata/Database");
        await initDatabase();
        const tables = await dbQuery("SHOW TABLES");
        const names = tables.map((r: any) => Object.values(r)[0] as string);
        for (const t of ["users", "user_tokens", "user_activities", "lfg", "lfg_members", "misc", "discordToken"]) {
            expect(names).toContain(t);
        }
    });
});
