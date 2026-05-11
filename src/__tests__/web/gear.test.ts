import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockGetGearAsset     = mock(() => null);
const mockGetItemDef       = mock(() => null);
const mockCacheItemDef     = mock(() => {});
const mockFetchDescriptor  = mock(() => Promise.resolve(null));
const mockGetCDNBase       = mock(() => "");

mock.module("../../automata/ManifestCache", () => ({
    manifestCache: {
        getGearAsset: mockGetGearAsset,
        getItemDef: mockGetItemDef,
        cacheItemDef: mockCacheItemDef,
        fetchGearDescriptor: mockFetchDescriptor,
        getCDNBase: mockGetCDNBase,
    }
}));

const mockApiRequest  = mock(() => Promise.resolve({ Response: null }));
const mockRefreshToken = mock(() => Promise.resolve({
    access_token: "fresh_tok", expires_in: 3600,
    refresh_token: "fresh_ref", refresh_expires_in: 7776000,
}));
mock.module("../../automata/BungieAPI", () => ({
    bungieAPI: { apiRequest: mockApiRequest, refreshToken: mockRefreshToken }
}));

const mockDbQuery = mock(() => Promise.resolve([]));
mock.module("../../automata/Database", () => ({ dbQuery: mockDbQuery }));

const mockDecrypt = mock(() => Promise.resolve("123456789012345678"));
mock.module("../../utils/crypt", () => ({ decrypt: mockDecrypt, encrypt: mock(() => Promise.resolve("enc")) }));

const mockAxiosGet = mock(() => Promise.resolve({
    headers: { "content-type": "image/png" },
    data: { pipe: (res: any) => res.end() }
}));
mock.module("axios", () => ({
    default: { get: mockAxiosGet, post: mock(() => Promise.resolve({})) },
    get: mockAxiosGet,
    post: mock(() => Promise.resolve({})),
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import gearRouter from "../../web/endpoints/gear";

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use("/api/gear", gearRouter);

// ── GET /assets/:itemHash ────────────────────────────────────────────────────

describe("GET /api/gear/assets/:itemHash", () => {
    beforeEach(() => { mockGetGearAsset.mockReset(); });

    it("returns 400 for non-numeric hash", async () => {
        const res = await request(app).get("/api/gear/assets/notanumber");
        expect(res.status).toBe(400);
    });

    it("returns 404 when hash absent from gear asset cache", async () => {
        mockGetGearAsset.mockReturnValueOnce(null);
        const res = await request(app).get("/api/gear/assets/123456");
        expect(res.status).toBe(404);
    });

    it("returns 200 JSON with cache header on hit", async () => {
        const asset = { geometry: ["file.tgx"], textures: ["tex.png"] };
        mockGetGearAsset.mockReturnValueOnce(asset);
        const res = await request(app).get("/api/gear/assets/123456");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(asset);
        expect(res.headers["cache-control"]).toContain("max-age=3600");
    });
});

// ── POST /assets-batch ───────────────────────────────────────────────────────

describe("POST /api/gear/assets-batch", () => {
    beforeEach(() => { mockGetGearAsset.mockReset(); });

    it("returns 400 for missing hashes field", async () => {
        expect((await request(app).post("/api/gear/assets-batch").send({})).status).toBe(400);
    });

    it("returns 400 for empty array", async () => {
        expect((await request(app).post("/api/gear/assets-batch").send({ hashes: [] })).status).toBe(400);
    });

    it("returns only found hashes", async () => {
        const asset = { geometry: ["a.tgx"] };
        mockGetGearAsset.mockImplementation((h: number) => h === 111 ? asset : null);
        const res = await request(app).post("/api/gear/assets-batch").send({ hashes: [111, 999] });
        expect(res.status).toBe(200);
        expect(res.body[111]).toEqual(asset);
        expect(res.body[999]).toBeUndefined();
    });

    it("skips negative and zero hashes", async () => {
        const res = await request(app).post("/api/gear/assets-batch").send({ hashes: [-1, 0, 1] });
        expect(res.status).toBe(200);
        expect(res.body[-1]).toBeUndefined();
    });
});

// ── GET /item-def/:itemHash ──────────────────────────────────────────────────

describe("GET /api/gear/item-def/:itemHash", () => {
    beforeEach(() => {
        mockGetItemDef.mockReset();
        mockApiRequest.mockReset();
        mockCacheItemDef.mockReset();
    });

    it("returns 400 for non-numeric hash", async () => {
        expect((await request(app).get("/api/gear/item-def/abc")).status).toBe(400);
    });

    it("returns cached def without calling Bungie API", async () => {
        const def = {
            displayProperties: { icon: "/img/icon.png", name: "Gjallarhorn" },
            itemSubType: 13, plug: null
        };
        mockGetItemDef.mockReturnValueOnce(def);
        const res = await request(app).get("/api/gear/item-def/123456");
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Gjallarhorn");
        expect(res.body.icon).toBe("/img/icon.png");
        expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("fetches from Bungie on cache miss and caches result", async () => {
        mockGetItemDef.mockReturnValueOnce(null);
        const def = { displayProperties: { icon: "/icon.png", name: "Gjallarhorn" }, itemSubType: 13, plug: null };
        mockApiRequest.mockResolvedValueOnce({ Response: def });
        const res = await request(app).get("/api/gear/item-def/123456");
        expect(res.status).toBe(200);
        expect(mockCacheItemDef).toHaveBeenCalledWith(123456, def);
    });

    it("returns 502 when Bungie API throws", async () => {
        mockGetItemDef.mockReturnValueOnce(null);
        mockApiRequest.mockRejectedValueOnce(new Error("API down"));
        expect((await request(app).get("/api/gear/item-def/123456")).status).toBe(502);
    });

    it("returns 404 when Bungie returns null Response", async () => {
        mockGetItemDef.mockReturnValueOnce(null);
        mockApiRequest.mockResolvedValueOnce({ Response: null });
        expect((await request(app).get("/api/gear/item-def/123456")).status).toBe(404);
    });

    it("response shape has expected fields", async () => {
        const def = {
            displayProperties: { icon: "/icon.png", name: "Weapon" },
            itemSubType: 5,
            plug: { plugCategoryHash: 42, plugCategoryIdentifier: "intrinsics", isDummyPlug: false }
        };
        mockGetItemDef.mockReturnValueOnce(def);
        const res = await request(app).get("/api/gear/item-def/1");
        expect(res.body).toMatchObject({
            icon: "/icon.png",
            name: "Weapon",
            itemSubType: 5,
            plugCategoryHash: 42,
            plugCategoryIdentifier: "intrinsics",
            isDummyPlug: false,
        });
    });
});

// ── GET /icon ────────────────────────────────────────────────────────────────

describe("GET /api/gear/icon", () => {
    beforeEach(() => { mockAxiosGet.mockReset(); });

    it("returns 400 when path query param is missing", async () => {
        expect((await request(app).get("/api/gear/icon")).status).toBe(400);
    });

    it("returns 400 for non-bungie host", async () => {
        const res = await request(app).get("/api/gear/icon?path=https://evil.com/img.png");
        expect(res.status).toBe(400);
    });

    it("returns 400 for protocol-relative URL resolving outside bungie", async () => {
        const res = await request(app).get("/api/gear/icon?path=//evil.com/img.png");
        expect(res.status).toBe(400);
    });

    it("proxies valid bungie relative icon path", async () => {
        mockAxiosGet.mockResolvedValueOnce({
            headers: { "content-type": "image/png" },
            data: { pipe: (r: any) => r.end("data") }
        });
        const res = await request(app).get("/api/gear/icon?path=/common/destiny2_content/icons/test.png");
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toContain("max-age=86400");
    });

    it("returns 400 when upstream is not an image", async () => {
        mockAxiosGet.mockResolvedValueOnce({
            headers: { "content-type": "text/html" },
            data: { pipe: (r: any) => r.end() }
        });
        const res = await request(app).get("/api/gear/icon?path=/path/to/file.html");
        expect(res.status).toBe(400);
    });
});

// ── POST /textures-batch ─────────────────────────────────────────────────────

describe("POST /api/gear/textures-batch", () => {
    beforeEach(() => { mockGetCDNBase.mockReset(); mockAxiosGet.mockReset(); });

    it("returns 400 for empty files array", async () => {
        expect((await request(app).post("/api/gear/textures-batch").send({ files: [] })).status).toBe(400);
    });

    it("returns 400 for filename with path traversal chars", async () => {
        const res = await request(app).post("/api/gear/textures-batch").send({ files: ["../etc/passwd"] });
        expect(res.status).toBe(400);
    });

    it("returns 400 for filename with spaces", async () => {
        const res = await request(app).post("/api/gear/textures-batch").send({ files: ["bad file.bin"] });
        expect(res.status).toBe(400);
    });

    it("returns 503 when CDN base is not configured", async () => {
        mockGetCDNBase.mockReturnValueOnce(null);
        const res = await request(app).post("/api/gear/textures-batch").send({ files: ["abc123.bin"] });
        expect(res.status).toBe(503);
    });

    it("returns binary octet-stream on success", async () => {
        mockGetCDNBase.mockReturnValue("/path/to/textures");
        mockAxiosGet.mockResolvedValue({ headers: {}, data: Buffer.from("fakedata") });
        const res = await request(app).post("/api/gear/textures-batch").send({ files: ["abc123.bin"] });
        expect(res.status).toBe(200);
        expect(res.type).toBe("application/octet-stream");
        expect(res.headers["cache-control"]).toContain("max-age=86400");
    });
});

// ── POST /gear-descs-batch ───────────────────────────────────────────────────

describe("POST /api/gear/gear-descs-batch", () => {
    beforeEach(() => { mockFetchDescriptor.mockReset(); });

    it("returns 400 for empty files", async () => {
        expect((await request(app).post("/api/gear/gear-descs-batch").send({ files: [] })).status).toBe(400);
    });

    it("returns 400 for invalid filename", async () => {
        const res = await request(app).post("/api/gear/gear-descs-batch").send({ files: ["../bad"] });
        expect(res.status).toBe(400);
    });

    it("returns JSON map with found descriptors only", async () => {
        const descriptor = { dyes: [], geometry: [] };
        mockFetchDescriptor.mockImplementation(async (f: string) => f === "abc.json" ? descriptor : null);
        const res = await request(app).post("/api/gear/gear-descs-batch").send({ files: ["abc.json", "missing.json"] });
        expect(res.status).toBe(200);
        expect(res.body["abc.json"]).toEqual(descriptor);
        expect(res.body["missing.json"]).toBeUndefined();
    });
});

// ── GET /gear-desc/:md5 ──────────────────────────────────────────────────────

describe("GET /api/gear/gear-desc/:md5", () => {
    beforeEach(() => { mockFetchDescriptor.mockReset(); });

    it("returns 404 when descriptor not found", async () => {
        mockFetchDescriptor.mockResolvedValueOnce(null);
        expect((await request(app).get("/api/gear/gear-desc/abc123md5")).status).toBe(404);
    });

    it("returns descriptor JSON on hit", async () => {
        const descriptor = { dyes: [1, 2] };
        mockFetchDescriptor.mockResolvedValueOnce(descriptor);
        const res = await request(app).get("/api/gear/gear-desc/abc123md5");
        expect(res.status).toBe(200);
        expect(res.body).toEqual(descriptor);
    });
});

// ── POST /geometry-batch ─────────────────────────────────────────────────────

describe("POST /api/gear/geometry-batch", () => {
    beforeEach(() => { mockGetCDNBase.mockReset(); mockAxiosGet.mockReset(); });

    it("returns 400 for empty files", async () => {
        expect((await request(app).post("/api/gear/geometry-batch").send({ files: [] })).status).toBe(400);
    });

    it("returns 400 for filename with path traversal", async () => {
        const res = await request(app).post("/api/gear/geometry-batch").send({ files: ["../../etc/passwd"] });
        expect(res.status).toBe(400);
    });

    it("returns 503 when CDN base not configured", async () => {
        mockGetCDNBase.mockReturnValueOnce(null);
        const res = await request(app).post("/api/gear/geometry-batch").send({ files: ["valid.tgx"] });
        expect(res.status).toBe(503);
    });

    it("returns binary pack on success", async () => {
        mockGetCDNBase.mockReturnValue("/path/to/geo");
        mockAxiosGet.mockResolvedValue({ headers: {}, data: Buffer.from("geomdata") });
        const res = await request(app).post("/api/gear/geometry-batch").send({ files: ["valid.tgx"] });
        expect(res.status).toBe(200);
        expect(res.type).toBe("application/octet-stream");
    });

    it("omits files that fail to fetch — successful files still returned", async () => {
        mockGetCDNBase.mockReturnValue("/path/to/geo");
        mockAxiosGet
            .mockResolvedValueOnce({ headers: {}, data: Buffer.from("data1") })
            .mockRejectedValueOnce(new Error("404"));
        const res = await request(app).post("/api/gear/geometry-batch").send({ files: ["ok.tgx", "bad.tgx"] });
        expect(res.status).toBe(200);
        // Binary pack 4-byte count at offset 0 should be 1 (only the successful file)
        const body = Buffer.from(res.body as any);
        expect(body.readUInt32LE(0)).toBe(1);
    });
});

// ── GET /:assetType/:hash ────────────────────────────────────────────────────

describe("GET /api/gear/:assetType/:hash", () => {
    beforeEach(() => { mockGetCDNBase.mockReset(); });

    it("returns 400 for invalid asset type", async () => {
        expect((await request(app).get("/api/gear/InvalidType/abc123")).status).toBe(400);
    });

    it("returns 400 for hash with unsafe chars", async () => {
        const res = await request(app).get("/api/gear/Geometry/bad%2Fhash");
        expect([400, 404]).toContain(res.status);
    });

    it("returns 503 when CDN base not configured", async () => {
        mockGetCDNBase.mockReturnValueOnce(null);
        const res = await request(app).get("/api/gear/Geometry/validhash123");
        expect(res.status).toBe(503);
    });

    it("accepts all valid asset types", async () => {
        for (const type of ["Geometry", "Texture", "Shader", "Gear", "PlateRegion"]) {
            mockGetCDNBase.mockReturnValueOnce(null);
            const res = await request(app).get(`/api/gear/${type}/validhash`);
            expect(res.status).toBe(503); // CDN not configured, but type accepted
        }
    });

    it("proxies valid asset request", async () => {
        mockGetCDNBase.mockReturnValue("/cdn/geometry");
        mockAxiosGet.mockResolvedValueOnce({
            headers: { "content-type": "application/octet-stream" },
            data: { pipe: (r: any) => r.end("data") }
        });
        const res = await request(app).get("/api/gear/Geometry/abc123hash");
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toContain("max-age=86400");
    });
});

// ── POST /item-defs ──────────────────────────────────────────────────────────

describe("POST /api/gear/item-defs", () => {
    beforeEach(() => { mockGetItemDef.mockReset(); mockApiRequest.mockReset(); mockCacheItemDef.mockReset(); });

    it("returns 400 for empty hashes", async () => {
        expect((await request(app).post("/api/gear/item-defs").send({ hashes: [] })).status).toBe(400);
    });

    it("returns cached defs without calling Bungie", async () => {
        const def = { displayProperties: { icon: "/i.png", name: "Gjallarhorn" }, itemSubType: 13, plug: null };
        mockGetItemDef.mockReturnValueOnce(def);
        const res = await request(app).post("/api/gear/item-defs").send({ hashes: [123456] });
        expect(res.status).toBe(200);
        expect(res.body[123456].name).toBe("Gjallarhorn");
        expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("skips non-positive hashes silently", async () => {
        const res = await request(app).post("/api/gear/item-defs").send({ hashes: [-1, 0] });
        expect(res.status).toBe(200);
        expect(Object.keys(res.body)).toHaveLength(0);
    });

    it("fetches from Bungie for cache-miss hashes", async () => {
        mockGetItemDef.mockReturnValueOnce(null);
        const def = { displayProperties: { icon: "/i.png", name: "Arbalest" }, itemSubType: 13, plug: null };
        mockApiRequest.mockResolvedValueOnce({ Response: def });
        const res = await request(app).post("/api/gear/item-defs").send({ hashes: [999] });
        expect(res.status).toBe(200);
        expect(res.body[999].name).toBe("Arbalest");
        expect(mockCacheItemDef).toHaveBeenCalledWith(999, def);
    });
});

// ── GET /char-render/:membershipType/:destinyMembershipId/:characterId ───────

describe("GET /api/gear/char-render", () => {
    const PATH = "/api/gear/char-render/3/4611686018429191234/2305843009261547456";

    beforeEach(() => {
        mockDecrypt.mockReset();
        mockDbQuery.mockReset();
        mockRefreshToken.mockReset();
        mockAxiosGet.mockReset();
    });

    it("returns 401 when conflux cookie is absent", async () => {
        expect((await request(app).get(PATH)).status).toBe(401);
    });

    it("returns 401 when cookie decrypt throws", async () => {
        mockDecrypt.mockRejectedValueOnce(new Error("bad decrypt"));
        const res = await request(app).get(PATH).set("Cookie", "conflux=bad");
        expect(res.status).toBe(401);
    });

    it("returns 401 when decrypt returns falsy", async () => {
        mockDecrypt.mockResolvedValueOnce(undefined);
        const res = await request(app).get(PATH).set("Cookie", "conflux=bad");
        expect(res.status).toBe(401);
    });

    it("returns 404 when user not found in DB", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([]);
        const res = await request(app).get(PATH).set("Cookie", "conflux=val");
        expect(res.status).toBe(404);
    });

    it("returns 400 for non-numeric path params", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9999999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9999999,
        }]);
        const res = await request(app)
            .get("/api/gear/char-render/abc/def/ghi")
            .set("Cookie", "conflux=val");
        expect(res.status).toBe(400);
    });

    it("refreshes token when access_expiry within 5 min", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery
            .mockResolvedValueOnce([{
                access_token: "old_tok",
                access_expiry: Date.now() + 100_000, // inside 300s window
                refresh_token: "ref",
                refresh_expiry: Date.now() + 9999999,
            }])
            .mockResolvedValueOnce([]); // UPDATE confirmation
        mockRefreshToken.mockResolvedValueOnce({
            access_token: "fresh_tok", expires_in: 3600,
            refresh_token: "fresh_ref", refresh_expires_in: 7776000,
        });
        mockAxiosGet.mockResolvedValueOnce({
            headers: { "content-type": "image/png" },
            data: { pipe: (r: any) => r.end("img") }
        });
        const res = await request(app).get(PATH).set("Cookie", "conflux=val");
        expect(mockRefreshToken).toHaveBeenCalled();
        expect([200, 404]).toContain(res.status);
    });

    it("proxies render when authenticated and token valid", async () => {
        mockDecrypt.mockResolvedValueOnce("123456789012345678");
        mockDbQuery.mockResolvedValueOnce([{
            access_token: "tok", access_expiry: Date.now() + 9999999,
            refresh_token: "ref", refresh_expiry: Date.now() + 9999999,
        }]);
        mockAxiosGet.mockResolvedValueOnce({
            headers: { "content-type": "image/png" },
            data: { pipe: (r: any) => r.end("img") }
        });
        const res = await request(app).get(PATH).set("Cookie", "conflux=val");
        expect(res.status).toBe(200);
        expect(res.type).toContain("image");
    });
});
