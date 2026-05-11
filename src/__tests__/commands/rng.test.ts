import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));
mock.module("../../automata/Database", () => ({ dbQuery: mockDbQuery }));

const mockApiRequest  = mock(() => Promise.resolve({ Response: {} }));
const mockRefreshToken = mock(() => Promise.resolve({
    access_token: "new_tok", expires_in: 3600,
    refresh_token: "new_ref", refresh_expires_in: 7776000,
}));
mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest, refreshToken: mockRefreshToken }
}));

const mockGetItemDef   = mock(() => null);
const mockCacheItemDef = mock(() => {});
mock.module("../../automata/ManifestCache", () => ({
    manifestCache: { getItemDef: mockGetItemDef, cacheItemDef: mockCacheItemDef }
}));

import RNG, { pending } from "../../bot/commands/RNG";
import { makeChatInput, makeButton } from "../../__fixtures__/discordInteractions";
import { MessageFlags } from "discord.js";

// ── Constants (must match RNG.ts) ────────────────────────────────────────────
const KINETIC = 1498876634;
const ENERGY  = 2465295065;
const POWER   = 953998645;
const VAULT   = 138197802;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTokenRow(overrides: Record<string, any> = {}) {
    return {
        destiny_id: "111",
        membership_type: 3,
        access_token: "tok",
        access_expiry: Date.now() + 9_999_999,
        refresh_token: "ref",
        refresh_expiry: Date.now() + 9_999_999,
        ...overrides,
    };
}

function makeDef(slot: number, ammoType: number, tierType: number, name: string) {
    return {
        itemType: 3,
        displayProperties: { name, icon: "/icon.png" },
        equippingBlock: { ammoType },
        inventory: { tierType, bucketTypeHash: slot },
    };
}

function makeProfileResponse(charId: string, itemsBySlot: Array<{ hash: number; slot: number }>) {
    return {
        Response: {
            characters: { data: { [charId]: { dateLastPlayed: "2024-01-01T00:00:00Z" } } },
            characterInventories: {
                data: {
                    [charId]: {
                        items: itemsBySlot.map((i, idx) => ({
                            itemHash: i.hash,
                            itemInstanceId: `inst${idx}`,
                            bucketHash: i.slot,
                        })),
                    },
                },
            },
            characterEquipment: { data: { [charId]: { items: [] } } },
            profileInventory: { data: { items: [] } },
        },
    };
}

// Emoji fetch mock that satisfies both values() and find() calls in buildRNG
function makeEmojiClient() {
    return {
        ws: { ping: 42 },
        guilds: { cache: { get: mock(() => null) } },
        application: {
            emojis: {
                fetch: mock(() => Promise.resolve({
                    values: () => [
                        { id: "1", name: "first" },
                        { id: "2", name: "second" },
                    ],
                    find: (pred: (e: any) => boolean) => {
                        const fakes = [
                            { id: "10", name: "exotic" },
                            { id: "11", name: "primary" },
                            { id: "12", name: "energy" },
                            { id: "13", name: "heavy" },
                        ];
                        return fakes.find(pred) ?? undefined;
                    },
                }))
            }
        }
    };
}

function makeRNGEquipButton(ownerId = userId, actingUser = userId) {
    return makeButton(`rng-equip-${ownerId}`, {
        user: { id: actingUser },
        deferReply: mock(() => Promise.resolve()),
    });
}

function makeRerollButton(ownerId = userId, actingUser = userId) {
    return makeButton(`rng-reroll-${ownerId}`, {
        user: { id: actingUser },
        client: makeEmojiClient(),
    });
}

const cmd = new RNG();
const userId = "123456789012345678";

beforeEach(() => {
    mockDbQuery.mockClear();
    mockApiRequest.mockClear();
    mockRefreshToken.mockClear();
    mockGetItemDef.mockClear();
    mockCacheItemDef.mockClear();
    pending.clear();
});

// ── chatInput ────────────────────────────────────────────────────────────────

describe("RNG chatInput()", () => {
    it("defers and editReplies with error when user not registered", async () => {
        mockDbQuery.mockResolvedValueOnce([]);
        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);
        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("not registered") })
        );
        expect(interaction.reply).not.toHaveBeenCalled();
    });

    it("calls refreshToken when access_expiry is inside 5-min window", async () => {
        mockDbQuery
            .mockResolvedValueOnce([makeTokenRow({ access_expiry: Date.now() + 100_000 })])
            .mockResolvedValueOnce([]); // UPDATE
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                characters: { data: {} },
                characterInventories: { data: {} },
                characterEquipment: { data: {} },
                profileInventory: { data: { items: [] } },
            }
        });
        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);
        expect(mockRefreshToken).toHaveBeenCalled();
    });

    it("editReplies error when Bungie inventory fetch fails", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        mockApiRequest.mockRejectedValueOnce(new Error("Bungie down"));
        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Failed") })
        );
    });

    it("normal flow: defers, stores pending loadout, replies with IsComponentsV2 container", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);

        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [
                { hash: 1001, slot: KINETIC },
                { hash: 2001, slot: ENERGY },
                { hash: 3001, slot: POWER },
            ])
        );

        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "KineticGun") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY, 2, 5, "EnergyGun") })
            .mockResolvedValueOnce({ Response: makeDef(POWER, 3, 5, "PowerGun") });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(pending.has(userId)).toBe(true);

        const reply = interaction.editReply.mock.calls[0][0];
        expect(reply.flags).toBe(MessageFlags.IsComponentsV2);
        expect(reply.components).toBeDefined();
        expect(reply.components.length).toBeGreaterThan(0);
        expect(reply.embeds).toBeUndefined();
    });

    it("container has equip customId rng-equip-{userId}", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [{ hash: 1001, slot: KINETIC }])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest.mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "KineticGun") });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const reply = interaction.editReply.mock.calls[0][0];
        const containerJson = JSON.stringify(reply.components[0].toJSON());
        expect(containerJson).toContain(`rng-equip-${userId}`);
        expect(containerJson).toContain(`rng-reroll-${userId}`);
        expect(containerJson).toContain(`delete-${userId}`);
    });

    it("container includes exotic emoji in tier text for exotic weapons", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [{ hash: 1001, slot: KINETIC }])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest.mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 6, "ExoticGun") }); // tierType 6

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const containerJson = JSON.stringify(reply(interaction).components[0].toJSON());
        expect(containerJson).toContain("<:exotic:10>");
    });

    it("container includes ammo emojis in tier text", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [{ hash: 1001, slot: KINETIC }])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest.mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "PrimaryGun") }); // ammoType 1 = primary

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const containerJson = JSON.stringify(reply(interaction).components[0].toJSON());
        expect(containerJson).toContain("<:primary:11>");
    });

    it("uses manifest cache when def is already cached (no Bungie call for cached hashes)", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [{ hash: 1001, slot: KINETIC }])
        );
        mockGetItemDef.mockReturnValue(makeDef(KINETIC, 1, 5, "CachedGun"));

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        // apiRequest only once (getProfileInventory), not for def lookup
        expect(mockApiRequest).toHaveBeenCalledTimes(1);
        expect(mockCacheItemDef).not.toHaveBeenCalled();
    });

    it("handles vault items — resolves slot from def.inventory.bucketTypeHash", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                characters: { data: { [charId]: { dateLastPlayed: "2024-01-01T00:00:00Z" } } },
                characterInventories: { data: { [charId]: { items: [] } } },
                characterEquipment:   { data: { [charId]: { items: [] } } },
                profileInventory: { data: { items: [
                    { itemHash: 9001, itemInstanceId: "inst_vault", bucketHash: VAULT }
                ] } },
            }
        });
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest.mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "VaultGun") });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        expect(pending.has(userId)).toBe(true);
        expect(pending.get(userId)?.kinetic?.name).toBe("VaultGun");
    });

    it("editReplies 'no weapons' when inventory is empty", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                characters: { data: {} },
                characterInventories: { data: {} },
                characterEquipment: { data: {} },
                profileInventory: { data: { items: [] } },
            }
        });
        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("No weapons") })
        );
    });
});

// ── Ammo constraint ──────────────────────────────────────────────────────────

describe("RNG chatInput() — ammo constraint (at most one special in kinetic+energy)", () => {
    afterEach(() => { Math.random = Math.random; });

    it("rerolls kinetic when both k+e are special and Math.random < 0.5", async () => {
        Math.random = () => 0;

        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [
                { hash: 101, slot: KINETIC },
                { hash: 102, slot: KINETIC },
                { hash: 201, slot: ENERGY  },
                { hash: 301, slot: POWER   },
            ])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 2, 5, "SpecialK") })
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "PrimaryK") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 5, "SpecialE") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 5, "HeavyP")   });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const loadout = pending.get(userId)!;
        expect(loadout.kinetic?.ammoType).toBe(1);
        expect(loadout.energy?.ammoType).toBe(2);
    });

    it("rerolls energy when both k+e are special and Math.random >= 0.5", async () => {
        Math.random = () => 0.9;

        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [
                { hash: 101, slot: KINETIC },
                { hash: 201, slot: ENERGY  },
                { hash: 202, slot: ENERGY  },
                { hash: 301, slot: POWER   },
            ])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 2, 5, "SpecialK") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 5, "SpecialE") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  1, 5, "PrimaryE") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 5, "HeavyP")  });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const loadout = pending.get(userId)!;
        expect(loadout.kinetic?.ammoType).toBe(2);
        expect(loadout.energy?.ammoType).toBe(1);
    });

    it("keeps both special when no non-special alternative exists in reroll slot", async () => {
        Math.random = () => 0;

        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [
                { hash: 101, slot: KINETIC },
                { hash: 201, slot: ENERGY  },
                { hash: 301, slot: POWER   },
            ])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 2, 5, "SpecialK") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 5, "SpecialE") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 5, "HeavyP")  });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const loadout = pending.get(userId)!;
        expect(loadout.kinetic?.ammoType).toBe(2);
    });
});

// ── Exotic constraint ────────────────────────────────────────────────────────

describe("RNG chatInput() — exotic constraint (at most one exotic total)", () => {
    afterEach(() => { Math.random = Math.random; });

    it("allows one exotic without rerolling", async () => {
        Math.random = () => 0;

        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse("char1", [
                { hash: 101, slot: KINETIC },
                { hash: 201, slot: ENERGY  },
                { hash: 301, slot: POWER   },
            ])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 6, "ExoticK") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 5, "LegendE") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 5, "LegendP") });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const loadout = pending.get(userId)!;
        const exoticCount = [loadout.kinetic, loadout.energy, loadout.power]
            .filter(s => s?.tierType === 6).length;
        expect(exoticCount).toBe(1);
    });

    it("rerolls extra exotics when multiple slots pick exotic", async () => {
        Math.random = () => 0;

        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse("char1", [
                { hash: 101, slot: KINETIC },
                { hash: 201, slot: ENERGY  },
                { hash: 202, slot: ENERGY  },
                { hash: 301, slot: POWER   },
                { hash: 302, slot: POWER   },
            ])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest
            .mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 6, "ExoticK") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 6, "ExoticE") })
            .mockResolvedValueOnce({ Response: makeDef(ENERGY,  2, 5, "LegendE") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 6, "ExoticP") })
            .mockResolvedValueOnce({ Response: makeDef(POWER,   3, 5, "LegendP") });

        const interaction = makeChatInput({ user: { id: userId }, client: makeEmojiClient() });
        await cmd.chatInput(interaction);

        const loadout = pending.get(userId)!;
        const exoticCount = [loadout.kinetic, loadout.energy, loadout.power]
            .filter(s => s?.tierType === 6).length;
        expect(exoticCount).toBe(1);
        expect(loadout.kinetic?.tierType).toBe(6);
    });
});

// ── button() equip ────────────────────────────────────────────────────────────

describe("RNG button() equip", () => {
    it("replies ephemerally when user is not the loadout owner", async () => {
        const interaction = makeRNGEquipButton(userId, "different_user");
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ flags: MessageFlags.Ephemeral })
        );
    });

    it("replies ephemerally when no pending loadout exists", async () => {
        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ flags: MessageFlags.Ephemeral, content: expect.stringContaining("expired") })
        );
    });

    it("reports offline when profileTransitoryData is absent and activity non-zero", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: null, energy: null, power: null
        });
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9_999_999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9_999_999,
        }]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                profileTransitoryData: { data: null },
                characterActivities: {
                    data: { char1: { currentActivityHash: 82913930, dateActivityStarted: "2024-01-01T00:00:00Z" } }
                }
            }
        });
        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("offline") })
        );
    });

    it("reports character select when transitory absent and all activities idle", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: null, energy: null, power: null
        });
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9_999_999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9_999_999,
        }]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                profileTransitoryData: { data: null },
                characterActivities: {
                    data: { char1: { currentActivityHash: 0, dateActivityStarted: "2024-01-01T00:00:00Z" } }
                }
            }
        });
        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("character") })
        );
    });

    it("executes transfers and equip when online", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: {
                itemHash: 1001, name: "KineticGun", ammoType: 1, tierType: 5,
                instances: [{ instanceId: "inst1", charId: null, equipped: false }],
            },
            energy: null, power: null,
        });
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9_999_999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9_999_999,
        }]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                profileTransitoryData: { data: { currentActivity: { currentActivityHash: 82913930 } } },
                characterActivities: {
                    data: { char1: { dateActivityStarted: "2024-06-01T12:00:00Z" } }
                }
            }
        });
        mockApiRequest.mockResolvedValueOnce({ Response: {} }); // transferItem
        mockApiRequest.mockResolvedValueOnce({ Response: {} }); // equipItems

        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);

        const calls = mockApiRequest.mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain("transferItem");
        expect(calls).toContain("equipItems");
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Equipped") })
        );
        expect(pending.has(userId)).toBe(false);
    });

    it("reports when item is equipped on another char (no transferable instance)", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: {
                itemHash: 1001, name: "LockedGun", ammoType: 1, tierType: 5,
                instances: [{ instanceId: "inst1", charId: "char2", equipped: true }],
            },
            energy: null, power: null,
        });
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9_999_999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9_999_999,
        }]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                profileTransitoryData: { data: { currentActivity: {} } },
                characterActivities: { data: { char1: { dateActivityStarted: "2024-06-01T12:00:00Z" } } }
            }
        });

        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("another character") })
        );
    });

    it("falls back to stored targetCharId when status check throws", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: {
                itemHash: 1001, name: "KineticGun", ammoType: 1, tierType: 5,
                instances: [{ instanceId: "inst1", charId: "char1", equipped: false }],
            },
            energy: null, power: null,
        });
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9_999_999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9_999_999,
        }]);
        mockApiRequest.mockRejectedValueOnce(new Error("network error"));
        mockApiRequest.mockResolvedValueOnce({ Response: {} }); // equipItems

        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);

        const calls = mockApiRequest.mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain("equipItems");
    });

    it("updates DB token on refresh then uses new token", async () => {
        pending.set(userId, {
            membershipType: 3, destinyId: "111", targetCharId: "char1",
            kinetic: null, energy: null, power: null
        });
        mockDbQuery
            .mockResolvedValueOnce([{
                access_token: "old_tok",
                access_expiry: Date.now() + 100_000,
                refresh_token: "ref",
                refresh_expiry: Date.now() + 9_999_999,
            }])
            .mockResolvedValueOnce([]);
        mockApiRequest.mockResolvedValueOnce({
            Response: {
                profileTransitoryData: { data: null },
                characterActivities: { data: {} }
            }
        });

        const interaction = makeRNGEquipButton();
        await cmd.button(interaction);

        expect(mockRefreshToken).toHaveBeenCalled();
        expect(mockDbQuery).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE user_tokens"),
            expect.arrayContaining(["new_tok"])
        );
    });
});

// ── button() reroll ───────────────────────────────────────────────────────────

describe("RNG button() reroll", () => {
    it("replies ephemerally when user is not the loadout owner", async () => {
        const interaction = makeRerollButton(userId, "different_user");
        await cmd.button(interaction);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ flags: MessageFlags.Ephemeral })
        );
    });

    it("deferUpdates, re-rolls, stores new pending loadout, updates message with container", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        const charId = "char1";
        mockApiRequest.mockResolvedValueOnce(
            makeProfileResponse(charId, [{ hash: 1001, slot: KINETIC }])
        );
        mockGetItemDef.mockReturnValue(null);
        mockApiRequest.mockResolvedValueOnce({ Response: makeDef(KINETIC, 1, 5, "KineticGun") });

        const interaction = makeRerollButton();
        await cmd.button(interaction);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(pending.has(userId)).toBe(true);

        const reply = interaction.editReply.mock.calls[0][0];
        expect(reply.flags).toBe(MessageFlags.IsComponentsV2);
        expect(reply.components).toBeDefined();
    });

    it("editReplies error when reroll inventory fetch fails", async () => {
        mockDbQuery.mockResolvedValueOnce([makeTokenRow()]);
        mockApiRequest.mockRejectedValueOnce(new Error("Bungie down"));

        const interaction = makeRerollButton();
        await cmd.button(interaction);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("Failed") })
        );
        expect(pending.has(userId)).toBe(false);
    });

    it("editReplies error when user unregistered between roll and reroll", async () => {
        mockDbQuery.mockResolvedValueOnce([]); // no rows

        const interaction = makeRerollButton();
        await cmd.button(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining("not registered") })
        );
    });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function reply(interaction: any) {
    return interaction.editReply.mock.calls[0][0];
}
