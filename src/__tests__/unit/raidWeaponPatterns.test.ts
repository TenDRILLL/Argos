import { describe, it, expect } from "bun:test";
import { RAID_GROUPS, RAID_NAMES, weaponEmojiName } from "../../enums/raidWeaponPatterns";

describe("raidWeaponPatterns", () => {
    it("defines 9 raids", () => {
        expect(RAID_GROUPS.length).toBe(9);
    });

    it("RAID_NAMES matches RAID_GROUPS order and length", () => {
        expect(RAID_NAMES).toEqual(RAID_GROUPS.map(r => r.name));
    });

    it("total weapon count is 55", () => {
        const total = RAID_GROUPS.reduce((sum, r) => sum + r.weapons.length, 0);
        expect(total).toBe(55);
    });

    it("all weapon names are unique across all raids", () => {
        const names = RAID_GROUPS.flatMap(r => r.weapons.map(w => w.name));
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    it("all weapon types are non-empty strings", () => {
        for (const raid of RAID_GROUPS) {
            for (const weapon of raid.weapons) {
                expect(typeof weapon.type).toBe("string");
                expect(weapon.type.length).toBeGreaterThan(0);
            }
        }
    });

    it("all weapon names are non-empty strings", () => {
        for (const raid of RAID_GROUPS) {
            for (const weapon of raid.weapons) {
                expect(typeof weapon.name).toBe("string");
                expect(weapon.name.length).toBeGreaterThan(0);
            }
        }
    });

    describe("per-raid weapon counts", () => {
        const counts: Record<string, number> = {
            "Last Wish":            6,
            "Garden of Salvation":  7,
            "Deep Stone Crypt":     6,
            "Vault of Glass":       6,
            "Vow of the Disciple":  6,
            "King's Fall":          6,
            "Root of Nightmares":   6,
            "Crota's End":          6,
            "Salvation's Edge":     6,
        };

        for (const [raidName, expected] of Object.entries(counts)) {
            it(`${raidName} has ${expected} weapons`, () => {
                const raid = RAID_GROUPS.find(r => r.name === raidName);
                expect(raid).toBeDefined();
                expect(raid!.weapons.length).toBe(expected);
            });
        }
    });

    it("Nessa's Oblation is in Root of Nightmares (not Vow of the Disciple)", () => {
        const ron = RAID_GROUPS.find(r => r.name === "Root of Nightmares")!;
        const votd = RAID_GROUPS.find(r => r.name === "Vow of the Disciple")!;
        expect(ron.weapons.some(w => w.name === "Nessa's Oblation")).toBe(true);
        expect(votd.weapons.some(w => w.name === "Nessa's Oblation")).toBe(false);
    });

    it("Garden of Salvation includes Omniscient Eye", () => {
        const gos = RAID_GROUPS.find(r => r.name === "Garden of Salvation")!;
        expect(gos.weapons.some(w => w.name === "Omniscient Eye")).toBe(true);
    });

    describe("weaponEmojiName", () => {
        it("converts spaces to underscores", () => {
            expect(weaponEmojiName("Nation of Beasts")).toBe("Nation_of_Beasts");
        });

        it("removes hyphens", () => {
            expect(weaponEmojiName("Age-Old Bond")).toBe("AgeOld_Bond");
        });

        it("removes apostrophes", () => {
            expect(weaponEmojiName("Zaouli's Bane")).toBe("Zaoulis_Bane");
        });

        it("removes accented characters", () => {
            expect(weaponEmojiName("Fang of Ir Yût")).toBe("Fang_of_Ir_Yt");
        });

        it("removes apostrophe + accent combo", () => {
            // Praedyth's Revenge
            expect(weaponEmojiName("Praedyth's Revenge")).toBe("Praedyths_Revenge");
        });

        it("all weapon names produce unique emoji names", () => {
            const names = RAID_GROUPS.flatMap(r => r.weapons.map(w => weaponEmojiName(w.name)));
            expect(new Set(names).size).toBe(names.length);
        });

        it("all produced names are valid discord emoji names", () => {
            for (const raid of RAID_GROUPS) {
                for (const weapon of raid.weapons) {
                    const name = weaponEmojiName(weapon.name);
                    expect(name.length).toBeGreaterThanOrEqual(2);
                    expect(name.length).toBeLessThanOrEqual(32);
                    expect(/^[0-9A-Za-z_]+$/.test(name)).toBe(true);
                }
            }
        });
    });

    it("every raid has a non-empty shortName", () => {
        for (const raid of RAID_GROUPS) {
            expect(typeof raid.shortName).toBe("string");
            expect(raid.shortName.length).toBeGreaterThan(0);
        }
    });

    it("all 9 expected raids are present", () => {
        const names = RAID_GROUPS.map(r => r.name);
        const expected = [
            "Last Wish", "Garden of Salvation", "Deep Stone Crypt",
            "Vault of Glass", "Vow of the Disciple", "King's Fall",
            "Root of Nightmares", "Crota's End", "Salvation's Edge",
        ];
        for (const name of expected) {
            expect(names).toContain(name);
        }
    });
});
