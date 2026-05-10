import { describe, it, expect } from "bun:test";
import { buildLeaderboardOptions } from "../../bot/commands/Leaderboard";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";

describe("buildLeaderboardOptions()", () => {
    it("includes kd option", () => {
        const opts = buildLeaderboardOptions();
        expect(opts.find(o => o.value === "kd")).toBeDefined();
    });

    it("includes r-Total (Total Raid Completions)", () => {
        const opts = buildLeaderboardOptions();
        expect(opts.find(o => o.value === "r-Total")).toBeDefined();
    });

    it("includes d-Total (Total Dungeon Completions)", () => {
        const opts = buildLeaderboardOptions();
        expect(opts.find(o => o.value === "d-Total")).toBeDefined();
    });

    it("includes gm-Total (Total Grandmaster Completions)", () => {
        const opts = buildLeaderboardOptions();
        expect(opts.find(o => o.value === "gm-Total")).toBeDefined();
    });

    it("per-activity options match activityIdentifierDB keys", () => {
        const opts = buildLeaderboardOptions();
        const optValues = opts.map(o => o.value);
        for (const [key] of activityIdentifierDB) {
            const prefix = ["r", "d", "gm"][activityIdentifierDB.get(key)!.type];
            expect(optValues).toContain(`${prefix}-${key}`);
        }
    });

    it("type prefix maps correctly: r=raid(0), d=dungeon(1), gm=grandmaster(2)", () => {
        const opts = buildLeaderboardOptions();
        // Leviathan is a raid (type 0) → prefix "r"
        expect(opts.find(o => o.value === "r-Leviathan")).toBeDefined();
        // The Glassway is GM (type 2) → prefix "gm"
        expect(opts.find(o => o.value === "gm-The Glassway")).toBeDefined();
        // The Whisper is dungeon/exotic (type 1) → prefix "d"
        expect(opts.find(o => o.value === "d-The Whisper")).toBeDefined();
    });

    it("each option has a name and value string", () => {
        buildLeaderboardOptions().forEach(opt => {
            expect(typeof opt.name).toBe("string");
            expect(typeof opt.value).toBe("string");
            expect(opt.name.length).toBeGreaterThan(0);
            expect(opt.value.length).toBeGreaterThan(0);
        });
    });

    it("includes difficult variant options for activities with difficultName", () => {
        const opts = buildLeaderboardOptions();
        // Vault of Glass has Master
        expect(opts.find(o => o.value === "r-Vault of Glass, Master")).toBeDefined();
    });
});
