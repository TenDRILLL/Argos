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

router.get("/gear-desc/:md5", async (req, res) => {
    const { md5 } = req.params;
    if (!SAFE_HASH_RE.test(md5)) return res.status(400).send("Invalid hash");
    const descriptor = await manifestCache.fetchGearDescriptor(md5);
    if (!descriptor) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json(descriptor);
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
