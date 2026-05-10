import {bungieAPI} from "./BungieAPI";
import Database from 'better-sqlite3';
import { inflateRawSync } from 'zlib';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import axios from 'axios';

type CDNAssetType = "Geometry" | "Texture" | "Shader" | "Gear" | "PlateRegion";

interface DestinyManifestResponse {
    mobileGearCDN?: Partial<Record<CDNAssetType, string>>;
    mobileGearAssetDataBases?: Array<{ version: number; path: string }>;
    jsonWorldComponentContentPaths?: { [lang: string]: { [component: string]: string } };
}

function extractFirstZipEntry(zipBuf: Buffer): Buffer {
    const PK_SIG = 0x04034b50;
    if (zipBuf.readUInt32LE(0) !== PK_SIG) throw new Error('Not a ZIP file');
    const compressionMethod = zipBuf.readUInt16LE(8);
    const compressedSize = zipBuf.readUInt32LE(18);
    const fileNameLen = zipBuf.readUInt16LE(26);
    const extraLen = zipBuf.readUInt16LE(28);
    const dataOffset = 30 + fileNameLen + extraLen;
    const compressedData = zipBuf.slice(dataOffset, dataOffset + compressedSize);
    if (compressionMethod === 0) return compressedData;
    if (compressionMethod === 8) return inflateRawSync(compressedData as any) as Buffer;
    throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

class ManifestCache {
    private cdnPaths: Partial<Record<CDNAssetType, string>> = {};
    private itemDefs: Map<number, any> = new Map();
    private dyeDefs: Map<number, any> = new Map();
    private gearAssets: Map<number, any> = new Map();
    private gearDescCache: Map<string, any> = new Map();

    async refresh(): Promise<void> {
        const manifest = await bungieAPI.apiRequest("getManifests", {});
        const resp = manifest.Response as DestinyManifestResponse;

        const mobileCDN = resp.mobileGearCDN ?? {};
        (Object.keys(mobileCDN) as CDNAssetType[]).forEach(key => {
            this.cdnPaths[key] = mobileCDN[key];
        });

        const dyePath: string | undefined = resp.jsonWorldComponentContentPaths?.en?.DestinyArtDyeChannelDefinition;
        if (dyePath) {
            const dyeData = await bungieAPI.rawRequest(`https://www.bungie.net${dyePath}`) as any;
            Object.keys(dyeData).forEach(hash => {
                this.dyeDefs.set(parseInt(hash), dyeData[hash]);
            });
        }

        const gearDbBases = resp.mobileGearAssetDataBases ?? [];
        if (gearDbBases.length > 0) {
            try {
                await this.loadGearDb(gearDbBases);
            } catch (e) {
                console.error('ManifestCache: gear DB load failed:', e);
            }
        }

        console.log(`ManifestCache refreshed — CDN paths: ${JSON.stringify(this.cdnPaths)}, dye defs: ${this.dyeDefs.size}, gear assets: ${this.gearAssets.size}`);
    }

    private async loadGearDb(dbBases: Array<{ version: number; path: string }>): Promise<void> {
        const sorted = [...dbBases].sort((a, b) => b.version - a.version);
        const fullDb = sorted.find(b => b.version >= 1) ?? sorted[0];
        if (!fullDb) return;

        const zipResp = await axios.get(`https://www.bungie.net${fullDb.path}`, {
            responseType: 'arraybuffer',
            headers: { 'X-API-Key': process.env.BUNGIE_API_KEY as string }
        });

        const sqliteBytes = extractFirstZipEntry(Buffer.from(zipResp.data));
        const tmpPath = join(tmpdir(), `argos-gear-${Date.now()}.content`);

        try {
            writeFileSync(tmpPath, sqliteBytes as any);
            const db = new Database(tmpPath, { readonly: true });
            const rows = db.prepare('SELECT id, json FROM DestinyGearAssetsDefinition').all() as Array<{ id: number; json: string }>;
            db.close();

            this.gearAssets.clear();
            for (const row of rows) {
                const unsignedHash = row.id < 0 ? row.id + 4294967296 : row.id;
                this.gearAssets.set(unsignedHash, JSON.parse(row.json));
            }
        } finally {
            if (existsSync(tmpPath)) unlinkSync(tmpPath);
        }
    }

    getCDNBase(assetType: CDNAssetType): string {
        return this.cdnPaths[assetType] ?? "";
    }

    getGearPath(artArrangementHash: number): string | null {
        const base = this.cdnPaths["Gear"];
        if (!base) return null;
        return `${base}/${artArrangementHash}`;
    }

    getGearAsset(itemHash: number): any | null {
        return this.gearAssets.get(itemHash) ?? null;
    }

    async fetchGearDescriptor(md5File: string): Promise<any | null> {
        const cached = this.gearDescCache.get(md5File);
        if (cached !== undefined) return cached;

        const gearBase = this.cdnPaths['Gear'];
        if (!gearBase) return null;

        try {
            const resp = await axios.get(`https://www.bungie.net${gearBase}/${md5File}`, {
                headers: { 'X-API-Key': process.env.BUNGIE_API_KEY as string }
            });
            const descriptor = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
            this.gearDescCache.set(md5File, descriptor);
            return descriptor;
        } catch {
            this.gearDescCache.set(md5File, null);
            return null;
        }
    }

    getDyeDef(dyeHash: number): any | null {
        return this.dyeDefs.get(dyeHash) ?? null;
    }

    getItemDef(itemHash: number): any | null {
        return this.itemDefs.get(itemHash) ?? null;
    }

    cacheItemDef(itemHash: number, def: any): void {
        this.itemDefs.set(itemHash, def);
    }
}

export const manifestCache = new ManifestCache();
