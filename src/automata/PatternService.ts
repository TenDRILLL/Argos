import { bungieAPI } from "./BungieAPI";
import { RAID_GROUPS } from "../enums/raidWeaponPatterns";

export interface WeaponPatternProgress {
    progress: number;
    completionValue: number;
}

export type PatternProgressMap = Map<string, WeaponPatternProgress>;

const PATTERN_DESC_FRAGMENT = "Completing Deepsight Resonance extractions on this weapon";

export class PatternService {
    private recordHashes: Map<string, number> = new Map();
    private initialized = false;
    private initPromise: Promise<void> | null = null;

    async init(): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;
        this.initPromise = this.loadHashes().then(() => {
            this.initialized = true;
            console.log(`PatternService: resolved ${this.recordHashes.size} / ${this.totalWeapons()} pattern hashes`);
        }).catch(e => {
            this.initPromise = null;
            throw e;
        });
        return this.initPromise;
    }

    private totalWeapons(): number {
        return RAID_GROUPS.reduce((sum, r) => sum + r.weapons.length, 0);
    }

    private async loadHashes(): Promise<void> {
        const manifest = await bungieAPI.apiRequest("getManifests", {});
        const resp = manifest.Response as any;
        const recordPath: string | undefined = resp?.jsonWorldComponentContentPaths?.en?.DestinyRecordDefinition;
        if (!recordPath) throw new Error("PatternService: DestinyRecordDefinition path missing from manifest");

        console.log("PatternService: downloading DestinyRecordDefinition...");
        const defs = await bungieAPI.rawRequest(`https://www.bungie.net${recordPath}`) as Record<string, any>;

        const weaponNames = new Set(RAID_GROUPS.flatMap(r => r.weapons.map(w => w.name)));

        for (const [hashStr, def] of Object.entries(defs)) {
            const name: string = def?.displayProperties?.name ?? "";
            const desc: string = def?.displayProperties?.description ?? "";
            if (!weaponNames.has(name)) continue;
            if (!desc.includes(PATTERN_DESC_FRAGMENT)) continue;
            const raw = parseInt(hashStr, 10);
            const hash = raw < 0 ? raw + 4294967296 : raw;
            this.recordHashes.set(name, hash);
        }
    }

    async getProgress(membershipType: number, destinyId: string): Promise<PatternProgressMap> {
        if (!this.initialized) await this.init();

        const response = await bungieAPI.apiRequest("getProfileRecords", {
            membershipType,
            destinyMembershipId: destinyId,
        });

        const records: Record<string, any> = (response.Response as any)?.profileRecords?.data?.records ?? {};
        const result: PatternProgressMap = new Map();

        for (const [weaponName, recordHash] of this.recordHashes) {
            const record = records[String(recordHash)];
            if (!record) continue;
            const obj = record.objectives?.[0];
            if (!obj) continue;
            result.set(weaponName, {
                progress: obj.progress ?? 0,
                completionValue: obj.completionValue ?? 5,
            });
        }

        return result;
    }

    get hashCount(): number {
        return this.recordHashes.size;
    }
}

export const patternService = new PatternService();
