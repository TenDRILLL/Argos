import { describe, it, expect } from "bun:test";
import { sortActivities } from "../../utils/sortActivities";
import { ActivityObject } from "../../structs/DBUser";

describe("sortActivities()", () => {
    it("returns activities sorted by type order (highest first)", () => {
        const input: ActivityObject = {
            "Last Wish": 10,
            "Vault of Glass": 5,
            "Garden of Salvation": 20,
            "Total": 35
        };
        const result = sortActivities(input);
        const keys = Object.keys(result);
        // First non-Total key should be Garden of Salvation (20)
        const nonTotal = keys.filter(k => k !== "Total");
        expect(result["Garden of Salvation"]).toBeDefined();
        expect(result["Garden of Salvation"][0]).toBe(20 as any);
    });

    it("Total key appears first when it has the highest value", () => {
        const input: ActivityObject = {
            "Last Wish": 5,
            "Vault of Glass": 3,
            "Total": 100
        };
        const result = sortActivities(input);
        // Total has value 100, highest — it appears first in sorted keys
        expect(Object.keys(result)[0]).toBe("Total");
    });

    it("empty input returns empty map", () => {
        const result = sortActivities({} as ActivityObject);
        expect(Object.keys(result).length).toBe(0);
    });

    it("activities with 0 clears are excluded from output", () => {
        const input: ActivityObject = {
            "Last Wish": 0,
            "Vault of Glass": 5,
            "Total": 5
        };
        const result = sortActivities(input);
        expect(result["Last Wish"]).toBeUndefined();
        expect(result["Vault of Glass"]).toBeDefined();
    });

    it("includes Master variant in base activity array", () => {
        const input: ActivityObject = {
            "Vault of Glass": 10,
            "Vault of Glass, Master": 3,
            "Total": 13
        };
        const result = sortActivities(input);
        const entry = result["Vault of Glass"];
        expect(entry).toBeDefined();
        expect(entry).toContain("Master");
        expect(entry).toContain(3 as any);
    });

    it("includes Heroic variant in base activity array", () => {
        const input: ActivityObject = {
            "The Whisper": 7,
            "The Whisper, Heroic": 2,
            "Total": 9
        };
        const result = sortActivities(input);
        const entry = result["The Whisper"];
        expect(entry).toBeDefined();
        expect(entry).toContain("Heroic");
    });

    it("includes Prestige variant in base activity array", () => {
        const input: ActivityObject = {
            "Leviathan": 15,
            "Leviathan, Prestige": 5,
            "Total": 20
        };
        const result = sortActivities(input);
        const entry = result["Leviathan"];
        expect(entry).toBeDefined();
        expect(entry).toContain("Prestige");
    });
});
