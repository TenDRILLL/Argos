import axios from "axios";
import { dbQuery } from "./Database";
import { bungieAPI } from "./BungieAPI";

const PGCR_DELAY_MS = 150;
const PAGE_DELAY_MS = 120;
const API_ROOT      = "https://www.bungie.net/platform";

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function isFresh(pgcr: any): boolean {
    if (pgcr.activityWasStartedFromBeginning === true) return true;
    if ((pgcr.startingPhaseIndex ?? 0) > 0) return false;
    return true;
}

export interface FreshClearResult {
    freshCount:  number;
    lastUpdated: number;
}

export class FreshClearService {
    private scanning = new Set<string>();

    isScanning(discordId: string): boolean {
        return this.scanning.has(discordId);
    }

    async getCached(discordId: string): Promise<FreshClearResult | null> {
        const rows = await dbQuery(
            "SELECT fresh_count, last_updated FROM user_fresh_clears WHERE discord_id = ?",
            [discordId]
        );
        if (!rows.length || rows[0].last_updated == null) return null;
        return {
            freshCount:  Number(rows[0].fresh_count),
            lastUpdated: Number(rows[0].last_updated),
        };
    }

    startScan(discordId: string, membershipType: number, destinyId: string): void {
        if (this.scanning.has(discordId)) return;
        this.scanning.add(discordId);
        this.runScan(discordId, membershipType, destinyId)
            .catch(e => console.error(`FreshClearService scan failed for ${discordId}:`, e))
            .finally(() => this.scanning.delete(discordId));
    }

    private async runScan(discordId: string, membershipType: number, destinyId: string): Promise<void> {
        const charResp  = await bungieAPI.apiRequest("getDestinyCharacters", { membershipType, destinyMembershipId: destinyId });
        const chars: string[] = ((charResp.Response as any).characters as any[]).map(c => c.characterId as string);

        const seen      = new Set<string>();
        const instances: string[] = [];

        for (const charId of chars) {
            for (const mode of [4, 82]) {
                let page = 0;
                while (true) {
                    const resp = await bungieAPI.apiRequest("getActivityHistory", {
                        membershipType,
                        destinyMembershipId: destinyId,
                        characterId:         charId,
                        query:               `mode=${mode}&count=250&page=${page}`,
                    });
                    const activities: any[] = (resp.Response as any)?.activities ?? [];
                    if (!activities.length) break;

                    for (const a of activities) {
                        const id: string    = a.activityDetails.instanceId;
                        const completed: number = a.values?.completed?.basic?.value ?? 0;
                        if (completed === 1 && !seen.has(id)) {
                            seen.add(id);
                            instances.push(id);
                        }
                    }

                    if (activities.length < 250) break;
                    page++;
                    await sleep(PAGE_DELAY_MS);
                }
                await sleep(PAGE_DELAY_MS);
            }
        }

        let freshCount = 0;
        for (const instanceId of instances) {
            try {
                const pgcr = await this.fetchPGCR(instanceId);
                if (isFresh(pgcr)) freshCount++;
            } catch {
                // skip
            }
            await sleep(PGCR_DELAY_MS);
        }

        const now = Date.now();
        await dbQuery(
            "INSERT INTO user_fresh_clears (discord_id, fresh_count, last_updated) VALUES (?,?,?) ON DUPLICATE KEY UPDATE fresh_count=?, last_updated=?",
            [discordId, freshCount, now, freshCount, now]
        );

        console.log(`FreshClearService: ${discordId} scan complete — ${freshCount}/${instances.length} fresh`);
    }

    private async fetchPGCR(instanceId: string): Promise<any> {
        const r = await axios.get(
            `${API_ROOT}/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
            { headers: { "X-API-Key": process.env.BUNGIE_API_KEY as string }, maxRedirects: 5 }
        );
        if (r.data.ErrorCode !== 1) throw new Error(`PGCR ${instanceId}: ${r.data.Message}`);
        return r.data.Response;
    }
}

export const freshClearService = new FreshClearService();
