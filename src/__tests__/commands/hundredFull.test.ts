import { describe, it, expect } from "bun:test";
import { buildRaidLine, CURRENT_RAIDS } from "../../bot/commands/D2Stats";
import { FreshClearResult } from "../../automata/FreshClearService";

// Ground-truth counts for RaidAngel871 (discord_id=484419124433518602), verified 2026-05-13.
// Source: live bot output matching Raid Report values.
const RAID_ANGEL_COUNTS: Record<string, number> = {
    "Last Wish":           100,
    "Garden of Salvation": 100,
    "Deep Stone Crypt":    100,
    "Vault of Glass":      100,
    "Vow of the Disciple":  78,
    "King's Fall":         100,
    "Root of Nightmares":   59,
    "Crota's End":          32,
    "Salvation's Edge":      9,
    "The Desert Perpetual":  3,
};

function makeCached(counts: Record<string, number>): FreshClearResult {
    return { counts: new Map(Object.entries(counts)), lastUpdated: 0 };
}

// No emoji cache → falls back to raid.short names. Pure string output, no Discord.js needed.
const NO_EMOJIS = null;

describe("hundredFull — buildRaidLine (RaidAngel871 ground truth)", () => {
    const cached = makeCached(RAID_ANGEL_COUNTS);

    it("Last Wish — 100/100 ⭐", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Last Wish")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("Last Wish    **100/100** ⭐");
    });

    it("Garden of Salvation — 100/100 ⭐", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Garden of Salvation")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("Garden    **100/100** ⭐");
    });

    it("Deep Stone Crypt — 100/100 ⭐", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Deep Stone Crypt")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("Deep Stone    **100/100** ⭐");
    });

    it("Vault of Glass — 100/100 ⭐", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Vault of Glass")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("VoG    **100/100** ⭐");
    });

    it("Vow of the Disciple — 78/100", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Vow of the Disciple")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("VotD    **78/100**");
    });

    it("King's Fall — 100/100 ⭐", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "King's Fall")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("King's Fall    **100/100** ⭐");
    });

    it("Root of Nightmares — 59/100", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Root of Nightmares")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("RoN    **59/100**");
    });

    it("Crota's End — 32/100", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Crota's End")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("Crota's End    **32/100**");
    });

    it("Salvation's Edge — 9/100", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "Salvation's Edge")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("Salvation's Edge    **9/100**");
    });

    it("The Desert Perpetual — 3/100", () => {
        const raid = CURRENT_RAIDS.find(r => r.key === "The Desert Perpetual")!;
        expect(buildRaidLine(raid, cached, NO_EMOJIS)).toBe("DP    **3/100**");
    });

    it("count > 100 is capped at 100 with ⭐", () => {
        const cached150 = makeCached({ "Last Wish": 150 });
        const raid = CURRENT_RAIDS.find(r => r.key === "Last Wish")!;
        expect(buildRaidLine(raid, cached150, NO_EMOJIS)).toBe("Last Wish    **100/100** ⭐");
    });

    it("missing key → shows 0/100", () => {
        const empty = makeCached({});
        const raid  = CURRENT_RAIDS.find(r => r.key === "Vow of the Disciple")!;
        expect(buildRaidLine(raid, empty, NO_EMOJIS)).toBe("VotD    **0/100**");
    });
});
