import {Router} from "express";
import axios from "axios";
import {manifestCache} from "../../automata/ManifestCache";
import {dbQuery} from "../../automata/Database";
import {bungieAPI} from "../../automata/BungieAPI";
import {decrypt} from "../../utils/crypt";

const router = Router();

const BUNGIE_CDN = "https://www.bungie.net";
const VALID_ASSET_TYPES = new Set(["Geometry", "Texture", "Shader", "Gear", "PlateRegion"]);
const SAFE_HASH_RE = /^[a-zA-Z0-9._-]+$/;
const NUMERIC_RE   = /^\d{1,20}$/;

router.get("/assets/:itemHash", (req, res) => {
    const hash = parseInt(req.params.itemHash, 10);
    if (isNaN(hash)) return res.status(400).json({ error: "Invalid hash" });
    const asset = manifestCache.getGearAsset(hash);
    if (!asset) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(asset);
});

router.post("/assets-batch", (req, res) => {
    const { hashes } = req.body;
    if (!Array.isArray(hashes) || hashes.length === 0)
        return res.status(400).json({ error: "hashes must be a non-empty array" });

    const result: Record<number, any> = {};
    for (const raw of hashes) {
        const hash = Number(raw);
        if (!Number.isFinite(hash) || hash <= 0) continue;
        const asset = manifestCache.getGearAsset(hash);
        if (asset) result[hash] = asset;
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(result);
});

router.get("/item-def/:itemHash", async (req, res) => {
    const hash = parseInt(req.params.itemHash, 10);
    if (isNaN(hash)) return res.status(400).json({ error: "Invalid hash" });

    let def = manifestCache.getItemDef(hash);
    if (!def) {
        try {
            const resp = await bungieAPI.apiRequest("getDestinyEntityDefinition", {
                entityType: "DestinyInventoryItemDefinition",
                hashIdentifier: hash
            });
            def = (resp as any).Response;
            if (def) manifestCache.cacheItemDef(hash, def);
        } catch {
            return res.status(502).json({ error: "Failed to fetch item definition" });
        }
    }

    if (!def) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({
        icon:                    def.displayProperties?.icon ?? null,
        name:                    def.displayProperties?.name ?? null,
        itemSubType:             def.itemSubType ?? null,
        plugCategoryHash:        def.plug?.plugCategoryHash ?? null,
        plugCategoryIdentifier:  def.plug?.plugCategoryIdentifier ?? null,
        isDummyPlug:             def.plug?.isDummyPlug ?? false,
    });
});

router.get("/icon", async (req, res) => {
    const iconPath = req.query.path as string;
    if (!iconPath) return res.status(400).send("Invalid icon path");
    let targetUrl: URL;
    try {
        targetUrl = new URL(iconPath, BUNGIE_CDN);
    } catch {
        return res.status(400).send("Invalid icon path");
    }
    if (targetUrl.host !== "www.bungie.net") return res.status(400).send("Invalid icon path");
    try {
        const upstream = await axios.get(targetUrl.toString(), { responseType: "stream" });
        const ct: string = upstream.headers["content-type"] ?? "";
        if (!ct.startsWith("image/")) return res.status(400).send("Not an image");
        res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "public, max-age=86400");
        upstream.data.pipe(res);
    } catch {
        res.status(502).send("Failed to fetch icon");
    }
});

router.post("/icons-batch", async (req, res) => {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0)
        return res.status(400).json({ error: "paths must be a non-empty array" });

    const fetched = await Promise.all(
        (paths as string[]).map(async (iconPath) => {
            let targetUrl: URL;
            try { targetUrl = new URL(iconPath, BUNGIE_CDN); } catch { return null; }
            if (targetUrl.host !== "www.bungie.net") return null;
            try {
                const r = await axios.get(targetUrl.toString(), { responseType: "arraybuffer" });
                const ct: string = r.headers["content-type"] ?? "";
                if (!ct.startsWith("image/")) return null;
                return { path: iconPath, ct, data: Buffer.from(r.data as ArrayBuffer) };
            } catch { return null; }
        })
    );

    // Binary pack: [4-byte count] then per entry: [2-byte path len][path][2-byte ct len][ct][4-byte data len][data]
    const valid = fetched.filter((r): r is { path: string; ct: string; data: Buffer } => r !== null);
    let size = 4;
    for (const { path, ct, data } of valid) size += 2 + Buffer.byteLength(path) + 2 + Buffer.byteLength(ct) + 4 + data.length;

    const out = Buffer.allocUnsafe(size);
    let off = 0;
    out.writeUInt32LE(valid.length, off); off += 4;
    for (const { path, ct, data } of valid) {
        const pb = Buffer.from(path), cb = Buffer.from(ct);
        out.writeUInt16LE(pb.length, off); off += 2;
        out.set(pb, off); off += pb.length;
        out.writeUInt16LE(cb.length, off); off += 2;
        out.set(cb, off); off += cb.length;
        out.writeUInt32LE(data.length, off); off += 4;
        out.set(data, off); off += data.length;
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(out);
});

router.post("/textures-batch", async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0)
        return res.status(400).json({ error: "files must be a non-empty array" });
    if (files.some((f: any) => typeof f !== "string" || !SAFE_HASH_RE.test(f)))
        return res.status(400).json({ error: "invalid file name" });

    const cdnBase = manifestCache.getCDNBase("Texture" as any);
    if (!cdnBase) return res.status(503).json({ error: "Manifest cache not ready" });

    const fetched = await Promise.all(
        (files as string[]).map(async (file) => {
            try {
                const r = await axios.get(`${BUNGIE_CDN}${cdnBase}/${file}`, {
                    responseType: "arraybuffer",
                    headers: { "X-API-Key": process.env.BUNGIE_API_KEY as string },
                });
                return { file, data: Buffer.from(r.data as ArrayBuffer) };
            } catch { return { file, data: null }; }
        })
    );

    const valid = fetched.filter((r): r is { file: string; data: Buffer } => r.data !== null);
    let size = 4;
    for (const { file, data } of valid) size += 2 + Buffer.byteLength(file) + 4 + data.length;
    const out = Buffer.allocUnsafe(size);
    let off = 0;
    out.writeUInt32LE(valid.length, off); off += 4;
    for (const { file, data } of valid) {
        const nb = Buffer.from(file);
        out.writeUInt16LE(nb.length, off); off += 2;
        out.set(nb, off); off += nb.length;
        out.writeUInt32LE(data.length, off); off += 4;
        out.set(data, off); off += data.length;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(out);
});

router.post("/gear-descs-batch", async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0)
        return res.status(400).json({ error: "files must be a non-empty array" });
    if (files.some((f: any) => typeof f !== "string" || !SAFE_HASH_RE.test(f)))
        return res.status(400).json({ error: "invalid file name" });

    const result: Record<string, any> = {};
    await Promise.all(
        (files as string[]).map(async (file) => {
            const descriptor = await manifestCache.fetchGearDescriptor(file);
            if (descriptor) result[file] = descriptor;
        })
    );
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json(result);
});

router.get("/gear-desc/:md5", async (req, res) => {
    const { md5 } = req.params;
    if (!SAFE_HASH_RE.test(md5)) return res.status(400).send("Invalid hash");
    const descriptor = await manifestCache.fetchGearDescriptor(md5);
    if (!descriptor) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json(descriptor);
});

router.post("/geometry-batch", async (req, res) => {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0)
        return res.status(400).json({ error: "files must be a non-empty array" });

    if (files.some((f: any) => typeof f !== "string" || !SAFE_HASH_RE.test(f)))
        return res.status(400).json({ error: "invalid file name" });

    const cdnBase = manifestCache.getCDNBase("Geometry" as any);
    if (!cdnBase) return res.status(503).json({ error: "Manifest cache not ready" });

    const fetched = await Promise.all(
        (files as string[]).map(async (file) => {
            try {
                const r = await axios.get(`${BUNGIE_CDN}${cdnBase}/${file}`, {
                    responseType: "arraybuffer",
                    headers: { "X-API-Key": process.env.BUNGIE_API_KEY as string },
                });
                return { file, data: Buffer.from(r.data as ArrayBuffer) };
            } catch {
                return { file, data: null };
            }
        })
    );

    // Binary pack: [4-byte count] then per file: [2-byte name len][name bytes][4-byte data len][data bytes]
    const valid = fetched.filter((r): r is { file: string; data: Buffer } => r.data !== null);
    let size = 4;
    for (const { file, data } of valid) size += 2 + Buffer.byteLength(file) + 4 + data.length;

    const out = Buffer.allocUnsafe(size);
    let off = 0;
    out.writeUInt32LE(valid.length, off); off += 4;
    for (const { file, data } of valid) {
        const nb = Buffer.from(file);
        out.writeUInt16LE(nb.length, off); off += 2;
        out.set(nb, off); off += nb.length;
        out.writeUInt32LE(data.length, off); off += 4;
        out.set(data, off); off += data.length;
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(out);
});

router.get("/:assetType/:hash", async (req, res) => {
    const { assetType, hash } = req.params;
    if (!VALID_ASSET_TYPES.has(assetType)) {
        return res.status(400).send("Invalid asset type");
    }
    if (!SAFE_HASH_RE.test(hash)) {
        return res.status(400).send("Invalid hash");
    }
    const cdnBase = manifestCache.getCDNBase(assetType as any);
    if (!cdnBase) {
        return res.status(503).send("Manifest cache not ready");
    }
    const assetUrl = `${BUNGIE_CDN}${cdnBase}/${hash}`;
    try {
        const upstream = await axios.get(assetUrl, {
            responseType: "stream",
            headers: { "X-API-Key": process.env.BUNGIE_API_KEY as string }
        });
        res.setHeader("Content-Type", upstream.headers["content-type"] ?? "application/octet-stream");
        res.setHeader("Cache-Control", "public, max-age=86400");
        upstream.data.pipe(res);
    } catch (e: any) {
        const status = e?.response?.status ?? 502;
        res.status(status).send("Failed to fetch asset");
    }
});

router.post("/item-defs", async (req, res) => {
    const { hashes } = req.body;
    if (!Array.isArray(hashes) || hashes.length === 0)
        return res.status(400).json({ error: "hashes must be a non-empty array" });

    const result: Record<number, any> = {};

    await Promise.all(hashes.map(async (raw: any) => {
        const hash = Number(raw);
        if (!Number.isFinite(hash) || hash <= 0) return;

        let def = manifestCache.getItemDef(hash);
        if (!def) {
            try {
                const resp = await bungieAPI.apiRequest("getDestinyEntityDefinition", {
                    entityType: "DestinyInventoryItemDefinition",
                    hashIdentifier: hash
                });
                def = (resp as any).Response;
                if (def) manifestCache.cacheItemDef(hash, def);
            } catch { /* skip missing hashes */ }
        }

        if (def) {
            result[hash] = {
                icon:                   def.displayProperties?.icon ?? null,
                name:                   def.displayProperties?.name ?? null,
                itemSubType:            def.itemSubType ?? null,
                plugCategoryHash:       def.plug?.plugCategoryHash ?? null,
                plugCategoryIdentifier: def.plug?.plugCategoryIdentifier ?? null,
                isDummyPlug:            def.plug?.isDummyPlug ?? false,
            };
        }
    }));

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(result);
});

router.get("/char-render/:membershipType/:destinyMembershipId/:characterId", async (req, res) => {
    const conflux = req.cookies["conflux"];
    if (!conflux) return res.status(401).send("Not authenticated");

    let discordId: string | void;
    try {
        discordId = await decrypt(process.env.ARGOS_ID_PASSWORD as string, conflux);
    } catch {
        return res.status(401).send("Invalid session");
    }
    if (!discordId) return res.status(401).send("Invalid session");

    const rows = await dbQuery(
        "SELECT access_token, access_expiry, refresh_token, refresh_expiry FROM user_tokens WHERE discord_id = ?",
        [discordId]
    );
    if (!rows.length) return res.status(404).send("User not found");

    let { access_token, access_expiry, refresh_token, refresh_expiry } = rows[0];

    if (Date.now() > (Number(access_expiry) - 300_000)) {
        try {
            const auth = await bungieAPI.refreshToken(refresh_token, Number(refresh_expiry));
            const now = Date.now();
            access_token = auth.access_token;
            await dbQuery(
                "UPDATE user_tokens SET access_token=?, access_expiry=?, refresh_token=?, refresh_expiry=? WHERE discord_id=?",
                [auth.access_token, now + auth.expires_in * 1000, auth.refresh_token, now + (auth.refresh_expires_in ?? 0) * 1000, discordId]
            );
        } catch {
            return res.status(502).send("Token refresh failed");
        }
    }

    const { membershipType, destinyMembershipId, characterId } = req.params;
    if (!NUMERIC_RE.test(membershipType) || !NUMERIC_RE.test(destinyMembershipId) || !NUMERIC_RE.test(characterId)) {
        return res.status(400).send("Invalid parameters");
    }
    const renderUrl = `${BUNGIE_CDN}/platform/Destiny2/${membershipType}/Profile/${destinyMembershipId}/Character/${characterId}/Render/`;

    try {
        const upstream = await axios.get(renderUrl, {
            responseType: "stream",
            headers: {
                "X-API-Key": process.env.BUNGIE_API_KEY as string,
                "Authorization": `Bearer ${access_token}`
            }
        });
        const ct: string = upstream.headers["content-type"] ?? "";
        if (!ct.startsWith("image/")) {
            return res.status(404).send("Not an image response");
        }
        res.setHeader("Content-Type", ct);
        res.setHeader("Cache-Control", "public, max-age=300");
        upstream.data.pipe(res);
    } catch (e: any) {
        const status = e?.response?.status ?? 502;
        res.status(status).send("Character render not available");
    }
});

export default router;
