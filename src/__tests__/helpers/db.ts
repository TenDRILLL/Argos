import { initDatabase, dbQuery } from "../../automata/Database";

export async function setupTestDb() {
    process.env.DB_NAME = "argos_test";
    await initDatabase();
}

export async function clearAllTables() {
    await dbQuery("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of ["users", "user_tokens", "user_activities", "lfg", "lfg_members", "misc", "discordToken"]) {
        await dbQuery(`TRUNCATE TABLE ${t}`);
    }
    await dbQuery("SET FOREIGN_KEY_CHECKS = 1");
}

export async function teardownTestDb() {
    await clearAllTables();
}
