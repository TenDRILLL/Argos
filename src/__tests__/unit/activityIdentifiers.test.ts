import { describe, it, expect } from "bun:test";
import { activityIdentifierDB } from "../../enums/activityIdentifiers";
import { ActivityIdentifierObject } from "../../structs/ActivityIdentifierObject";

describe("buildActivityIdentifierDB()", () => {
    it("returns a Map", () => {
        expect(activityIdentifierDB).toBeInstanceOf(Map);
    });

    it("has entries with IDs, type, difficultName, difficultIDs fields", () => {
        for (const [, data] of activityIdentifierDB) {
            expect(Array.isArray(data.IDs)).toBe(true);
            expect(typeof data.type).toBe("number");
            expect(typeof data.difficultName).toBe("string");
            expect(Array.isArray(data.difficultIDs)).toBe(true);
        }
    });

    it("has no duplicate keys", () => {
        const keys = Array.from(activityIdentifierDB.keys());
        const unique = new Set(keys);
        expect(keys.length).toBe(unique.size);
    });

    it("Map maintains insertion order", () => {
        const keys = Array.from(activityIdentifierDB.keys());
        expect(keys[0]).toBe("Leviathan");
    });

    it("Leviathan has type 0 (raid)", () => {
        const leviathan = activityIdentifierDB.get("Leviathan");
        expect(leviathan?.type).toBe(0);
    });

    it("Crota's End has type 0 (raid) — last raid entry", () => {
        const crota = activityIdentifierDB.get("Crota's End");
        expect(crota?.type).toBe(0);
    });

    it("GMs (The Glassway) have type 2 — verify against source code", () => {
        // Source: i <= 18 ? 0 : (i <= 40 ? 2 : 1)
        // GMs are entries 19-40 → type 2
        const glassway = activityIdentifierDB.get("The Glassway");
        expect(glassway?.type).toBe(2);
    });

    it("dungeon entries (The Whisper) have type 1 — verify against source code", () => {
        // Dungeons/exotic missions are entries 41+ → type 1
        const whisper = activityIdentifierDB.get("The Whisper");
        expect(whisper?.type).toBe(1);
    });

    it("Vault of Glass has difficultName Master", () => {
        const vog = activityIdentifierDB.get("Vault of Glass");
        expect(vog?.difficultName).toBe("Master");
        expect(vog?.difficultIDs.length).toBeGreaterThan(0);
    });

    it("Master/Prestige/Heroic variants merge into base entry (not separate keys)", () => {
        // "Vault of Glass, Master" should NOT be a separate key
        expect(activityIdentifierDB.has("Vault of Glass, Master")).toBe(false);
        expect(activityIdentifierDB.has("Leviathan, Prestige")).toBe(false);
        expect(activityIdentifierDB.has("The Whisper, Heroic")).toBe(false);
    });

    it("IDs arrays do not contain duplicates", () => {
        for (const [key, data] of activityIdentifierDB) {
            const unique = new Set(data.IDs);
            expect(data.IDs.length).toBe(unique.size);
        }
    });
});
