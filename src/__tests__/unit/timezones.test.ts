import { describe, it, expect } from "bun:test";
import { timezones } from "../../utils/timezones";

describe("timezones()", () => {
    it("returns an array of strings", () => {
        const result = timezones();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        result.forEach(tz => expect(typeof tz).toBe("string"));
    });

    it("contains Europe/Helsinki", () => {
        expect(timezones()).toContain("Europe/Helsinki");
    });

    it("contains America/New_York", () => {
        expect(timezones()).toContain("America/New_York");
    });

    it("has no duplicates", () => {
        const all = timezones();
        const unique = new Set(all);
        expect(all.length).toBe(unique.size);
    });

    it("all entries contain a / separator", () => {
        timezones().forEach(tz => {
            expect(tz).toContain("/");
        });
    });
});
