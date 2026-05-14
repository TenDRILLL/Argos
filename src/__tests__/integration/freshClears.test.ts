import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { initDatabase, dbQuery } from "../../automata/Database";
import { closeDatabase } from "../../automata/Database";
import { FreshClearService } from "../../automata/FreshClearService";
import { CURRENT_RAIDS } from "../../bot/commands/D2Stats";

// Guard — requires real DB + Bungie API creds
const canRun = !!(
    process.env.ARGOS_RUN_INTEGRATION &&
    process.env.DB_HOST &&
    process.env.BUNGIE_API_KEY
);
const maybeDescribe = canRun ? describe : describe.skip;

// Ground-truth for RaidAngel871, verified 2026-05-13 against Raid Report
const RAID_ANGEL: { discordId: string; expected: Record<string, number> } = {
    discordId: "484419124433518602",
    expected: {
        "Last Wish":            100,
        "Garden of Salvation":  100,
        "Deep Stone Crypt":     100,
        "Vault of Glass":       100,
        "Vow of the Disciple":   78,
        "King's Fall":          100,
        "Root of Nightmares":    59,
        "Crota's End":           32,
        "Salvation's Edge":       9,
        "The Desert Perpetual":   3,
    },
};

maybeDescribe("FreshClearService integration — RaidAngel871 ground truth", () => {
    let counts: Map<string, number>;

    beforeAll(async () => {
        await initDatabase();
        const rows: any[] = await dbQuery(
            "SELECT destiny_id, membership_type FROM users WHERE discord_id = ?",
            [RAID_ANGEL.discordId]
        );
        if (!rows[0]?.destiny_id) {
            throw new Error(`User ${RAID_ANGEL.discordId} not found in DB — register first`);
        }
        const { destiny_id, membership_type } = rows[0];
        console.log(`Running fresh clear scan for ${RAID_ANGEL.discordId} (destiny=${destiny_id})...`);

        const svc = new FreshClearService({ pageDelayMs: 120, userGapMs: 0 });
        counts = await svc.scan(membership_type, destiny_id);

        console.log("\n=== Fresh Clear Results ===");
        for (const raid of CURRENT_RAIDS) {
            const got      = counts.get(raid.key) ?? 0;
            const capped   = Math.min(got, 100);
            const expected = RAID_ANGEL.expected[raid.key] ?? 0;
            const star     = capped >= 100 ? " ⭐" : "";
            const ok       = capped === expected ? "✓" : `✗ (expected ${expected})`;
            console.log(`  ${raid.short.padEnd(20)} ${String(capped).padStart(3)}/100${star.padEnd(2)}  ${ok}`);
        }
        console.log("");
    }, 300_000); // 5-min timeout for full API scan

    afterAll(async () => {
        await closeDatabase();
    });

    for (const raid of CURRENT_RAIDS) {
        const expected = RAID_ANGEL.expected[raid.key] ?? 0;
        it(`${raid.short}: displays ${expected}/100${expected >= 100 ? " ⭐" : ""}`, () => {
            const got    = counts.get(raid.key) ?? 0;
            const capped = Math.min(got, 100);
            expect(capped).toBe(expected);
        });
    }
});
