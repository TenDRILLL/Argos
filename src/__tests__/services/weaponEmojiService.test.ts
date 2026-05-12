import { describe, it, expect, mock, beforeEach } from "bun:test";

// --- mocks must be declared before imports ---

const mockApiRequest = mock(() => Promise.resolve({
    Response: {
        jsonWorldComponentContentPaths: {
            en: { DestinyInventoryItemDefinition: "/path/to/items.json" }
        }
    },
    ErrorCode: 1,
    ThrottleSeconds: 0,
}));

const fakeItemDefs: Record<string, any> = {
    "111": {
        displayProperties: {
            name: "Age-Old Bond",
            icon: "/common/destiny2_content/icons/age_old_bond.jpg",
        }
    },
    "222": {
        displayProperties: {
            name: "Rufus's Fury",
            icon: "/common/destiny2_content/icons/rufus_fury.jpg",
        }
    },
    // duplicate name — only first should be stored
    "333": {
        displayProperties: {
            name: "Age-Old Bond",
            icon: "/common/destiny2_content/icons/age_old_bond_adept.jpg",
        }
    },
    // weapon with no icon — should be skipped
    "444": {
        displayProperties: {
            name: "Trustee",
            icon: "",
        }
    },
};

const mockRawRequest = mock(() => Promise.resolve(fakeItemDefs));

mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest, rawRequest: mockRawRequest }
}));

import { WeaponEmojiService } from "../../automata/WeaponEmojiService";
import { weaponEmojiName, RAID_GROUPS } from "../../enums/raidWeaponPatterns";

function makeClient(existingEmojis: { name: string; id: string }[] = []) {
    const emojiCollection = {
        find: (fn: (e: any) => boolean) => existingEmojis.map(e => ({
            ...e,
            toString: () => `<:${e.name}:${e.id}>`
        })).find(fn),
    };
    return {
        application: {
            emojis: {
                fetch: mock(() => Promise.resolve(emojiCollection)),
                create: mock(({ name, attachment }: { name: string; attachment: string }) =>
                    Promise.resolve({
                        name,
                        id: "999",
                        toString: () => `<:${name}:999>`,
                    })
                ),
            }
        }
    } as any;
}

describe("weaponEmojiName", () => {
    it("replaces spaces with underscores", () => {
        expect(weaponEmojiName("Age-Old Bond")).toBe("AgeOld_Bond");
    });

    it("removes apostrophes", () => {
        expect(weaponEmojiName("Rufus's Fury")).toBe("Rufuss_Fury");
    });

    it("removes accented characters", () => {
        expect(weaponEmojiName("Fang of Ir Yût")).toBe("Fang_of_Ir_Yt");
    });

    it("removes hyphens", () => {
        expect(weaponEmojiName("Non-Denouement")).toBe("NonDenouement");
    });

    it("all raid weapons produce valid discord emoji names (2-32 chars, alphanumeric + _)", () => {
        for (const raid of RAID_GROUPS) {
            for (const weapon of raid.weapons) {
                const name = weaponEmojiName(weapon.name);
                expect(name.length).toBeGreaterThanOrEqual(2);
                expect(name.length).toBeLessThanOrEqual(32);
                expect(/^[0-9A-Za-z_]+$/.test(name)).toBe(true);
            }
        }
    });

    it("all raid weapon emoji names are unique", () => {
        const names = RAID_GROUPS.flatMap(r => r.weapons.map(w => weaponEmojiName(w.name)));
        expect(new Set(names).size).toBe(names.length);
    });
});

describe("WeaponEmojiService", () => {
    let service: WeaponEmojiService;

    beforeEach(() => {
        service = new WeaponEmojiService();
        mockApiRequest.mockClear();
        mockRawRequest.mockClear();
    });

    describe("getWeaponEmoji()", () => {
        it("returns empty string before sync", () => {
            expect(service.getWeaponEmoji("Age-Old Bond")).toBe("");
        });
    });

    describe("syncEmojis()", () => {
        it("fetches manifest then DestinyInventoryItemDefinition", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            expect(mockApiRequest).toHaveBeenCalledWith("getManifests", {});
            expect(mockRawRequest).toHaveBeenCalledWith("https://www.bungie.net/path/to/items.json");
        });

        it("creates emoji when not already present", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            expect(client.application.emojis.create).toHaveBeenCalledWith({
                name: "AgeOld_Bond",
                attachment: "https://bungie.net/common/destiny2_content/icons/age_old_bond.jpg",
            });
        });

        it("does not create emoji when it already exists", async () => {
            const client = makeClient([{ name: "AgeOld_Bond", id: "123" }]);
            await service.syncEmojis(client);
            const createCalls = (client.application.emojis.create as ReturnType<typeof mock>).mock.calls;
            const createdNames = createCalls.map((c: any[]) => c[0].name);
            expect(createdNames).not.toContain("AgeOld_Bond");
        });

        it("stores existing emoji string from cache", async () => {
            const client = makeClient([{ name: "AgeOld_Bond", id: "123" }]);
            await service.syncEmojis(client);
            expect(service.getWeaponEmoji("Age-Old Bond")).toBe("<:AgeOld_Bond:123>");
        });

        it("stores newly created emoji string", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            expect(service.getWeaponEmoji("Age-Old Bond")).toBe("<:AgeOld_Bond:999>");
        });

        it("does not create emoji when icon is missing from manifest", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            const createCalls = (client.application.emojis.create as ReturnType<typeof mock>).mock.calls;
            const createdNames = createCalls.map((c: any[]) => c[0].name);
            expect(createdNames).not.toContain("Trustee");
        });

        it("returns empty string for weapon with no icon after sync", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            expect(service.getWeaponEmoji("Trustee")).toBe("");
        });

        it("uses first definition when weapon name appears multiple times", async () => {
            const client = makeClient();
            await service.syncEmojis(client);
            const createCalls = (client.application.emojis.create as ReturnType<typeof mock>).mock.calls;
            const ageOldCall = createCalls.find((c: any[]) => c[0].name === "AgeOld_Bond");
            expect(ageOldCall?.[0].attachment).toBe(
                "https://bungie.net/common/destiny2_content/icons/age_old_bond.jpg"
            );
        });

        it("logs error and returns when manifest path is missing", async () => {
            mockApiRequest.mockResolvedValueOnce({
                Response: { jsonWorldComponentContentPaths: { en: {} } },
                ErrorCode: 1,
                ThrottleSeconds: 0,
            });
            const client = makeClient();
            await service.syncEmojis(client); // must not throw
            expect(mockRawRequest).not.toHaveBeenCalled();
            expect(service.getWeaponEmoji("Age-Old Bond")).toBe("");
        });

        it("continues when emoji creation fails", async () => {
            const client = makeClient();
            (client.application.emojis.create as ReturnType<typeof mock>).mockRejectedValueOnce(new Error("rate limited"));
            await expect(service.syncEmojis(client)).resolves.toBeUndefined();
        });
    });
});
