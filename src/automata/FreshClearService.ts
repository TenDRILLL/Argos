import { dbQuery } from "./Database";
import { bungieAPI } from "./BungieAPI";
import { activityIdentifierDB } from "../enums/activityIdentifiers";

const PAGE_DELAY_MS    = 120;
const USER_GAP_MS      = 2_000;
// Bungie added activityWasStartedFromBeginning to PGCRs at Witch Queen launch.
// Pre-WQ PGCRs default the field to false (unreliable); post-WQ false = explicit checkpoint.
const WITCH_QUEEN_EPOCH = new Date("2022-02-22T17:00:00Z").getTime();

export interface FreshClearServiceOptions {
    pageDelayMs?: number;
    userGapMs?:   number;
}

export interface FreshClearResult {
    counts:      Map<string, number>;  // activity_key → fresh count
    lastUpdated: number;
}

interface PendingUser {
    discord_id:      string;
    destiny_id:      string;
    membership_type: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// Maps every activity hash → base activity key (raids + dungeons only)
function buildHashToKey(): Map<number, string> {
    const map = new Map<number, string>();
    for (const [key, data] of activityIdentifierDB) {
        if (data.type !== 0 && data.type !== 1) continue;
        for (const id of [...data.IDs, ...data.difficultIDs]) {
            map.set(id, key);
        }
    }
    return map;
}

export class FreshClearService {
    private readonly pageDelayMs:  number;
    private readonly userGapMs:    number;

    private scanning           = new Set<string>();
    private initialRunning     = false;
    private incrementalRunning = false;

    constructor(opts?: FreshClearServiceOptions) {
        this.pageDelayMs = opts?.pageDelayMs ?? PAGE_DELAY_MS;
        this.userGapMs   = opts?.userGapMs   ?? USER_GAP_MS;
    }

    // ── public API ───────────────────────────────────────────────────────────

    async scan(membershipType: number, destinyId: string): Promise<Map<string, number>> {
        const hashToKey = buildHashToKey();
        const chars     = await this.getCharacterIds(membershipType, destinyId);
        return this.fetchAllFresh(membershipType, destinyId, chars, hashToKey);
    }

    isScanning(discordId: string): boolean {
        return this.scanning.has(discordId);
    }

    async getCached(discordId: string): Promise<FreshClearResult | null> {
        const rows = await dbQuery(
            "SELECT activity_key, fresh_count, last_updated FROM user_fresh_clears WHERE discord_id = ?",
            [discordId]
        );
        if (!rows.length) return null;

        const counts = new Map<string, number>();
        let lastUpdated = 0;
        for (const r of rows) {
            counts.set(r.activity_key as string, Number(r.fresh_count));
            const ts = Number(r.last_updated);
            if (ts > lastUpdated) lastUpdated = ts;
        }
        return { counts, lastUpdated };
    }

    startScan(discordId: string, membershipType: number, destinyId: string): void {
        if (this.scanning.has(discordId)) return;
        this.scanning.add(discordId);
        this.runFullScan(discordId, membershipType, destinyId)
            .catch(e => console.error(`FreshClearService full scan failed [${discordId}]:`, e))
            .finally(() => this.scanning.delete(discordId));
    }

    startInitialScanForAll(): void {
        if (this.initialRunning) return;
        this.initialRunning = true;
        this.runInitialBatch()
            .catch(e => console.error("FreshClearService initial batch failed:", e))
            .finally(() => { this.initialRunning = false; });
    }

    startIncrementalUpdateAll(): void {
        if (this.incrementalRunning) return;
        this.incrementalRunning = true;
        this.runIncrementalBatch()
            .catch(e => console.error("FreshClearService incremental batch failed:", e))
            .finally(() => { this.incrementalRunning = false; });
    }

    // ── internal batch runners ───────────────────────────────────────────────

    private async runInitialBatch(): Promise<void> {
        const users: PendingUser[] = await dbQuery(
            `SELECT discord_id, destiny_id, membership_type
             FROM users
             WHERE destiny_id IS NOT NULL AND fresh_scanned_at IS NULL`
        );
        if (!users.length) {
            console.log("FreshClearService: all users already have fresh clear data.");
            return;
        }
        console.log(`FreshClearService: initial batch — ${users.length} user(s) to scan.`);
        for (const u of users) {
            if (this.scanning.has(u.discord_id)) { await sleep(this.userGapMs); continue; }
            this.scanning.add(u.discord_id);
            try {
                console.log(`FreshClearService: Scanning user [${u.discord_id}]`);
                await this.runFullScan(u.discord_id, u.membership_type, u.destiny_id);
            } catch (e) {
                console.error(`FreshClearService initial scan failed [${u.discord_id}]:`, e);
            } finally {
                console.log(`FreshClearService: Scanning user [${u.discord_id}] complete.`);
                this.scanning.delete(u.discord_id);
            }
            await sleep(this.userGapMs);
        }
        console.log("FreshClearService: initial batch complete.");
    }

    private async runIncrementalBatch(): Promise<void> {
        const users: Array<PendingUser & { last_updated: number }> = await dbQuery(
            `SELECT u.discord_id, u.destiny_id, u.membership_type,
                    COALESCE(MAX(fc.last_updated), u.fresh_scanned_at) AS last_updated
             FROM users u
             LEFT JOIN user_fresh_clears fc ON u.discord_id = fc.discord_id
             WHERE u.destiny_id IS NOT NULL AND u.fresh_scanned_at IS NOT NULL
             GROUP BY u.discord_id, u.destiny_id, u.membership_type, u.fresh_scanned_at`
        );
        if (!users.length) return;
        for (const u of users) {
            if (this.scanning.has(u.discord_id)) continue;
            try {
                await this.runIncrementalUpdate(u.discord_id, u.membership_type, u.destiny_id, Number(u.last_updated));
            } catch (e) {
                console.error(`FreshClearService incremental update failed [${u.discord_id}]:`, e);
            }
            await sleep(this.userGapMs);
        }
    }

    // ── scan implementations ─────────────────────────────────────────────────

    private async runFullScan(discordId: string, membershipType: number, destinyId: string): Promise<void> {
        const hashToKey = buildHashToKey();
        const chars     = await this.getCharacterIds(membershipType, destinyId);
        const counts    = await this.fetchAllFresh(membershipType, destinyId, chars, hashToKey);

        await this.saveCounts(discordId, counts);
        await dbQuery("UPDATE users SET fresh_scanned_at = ? WHERE discord_id = ?", [Date.now(), discordId]);
        const total = [...counts.values()].reduce((a, b) => a + b, 0);
        console.log(`FreshClearService: [${discordId}] full scan done — ${total} fresh`);
    }

    private async runIncrementalUpdate(
        discordId:      string,
        membershipType: number,
        destinyId:      string,
        lastUpdated:    number
    ): Promise<void> {
        const hashToKey = buildHashToKey();
        const chars     = await this.getCharacterIds(membershipType, destinyId);
        const delta     = await this.fetchNewFresh(membershipType, destinyId, chars, lastUpdated, hashToKey);
        if (!delta.size) return;

        const existing = await this.getExistingCounts(discordId);
        for (const [key, count] of delta) {
            existing.set(key, (existing.get(key) ?? 0) + count);
        }
        await this.saveCounts(discordId, existing);
        const total = [...delta.values()].reduce((a, b) => a + b, 0);
        console.log(`FreshClearService: [${discordId}] incremental +${total} fresh`);
    }

    // ── activity history helpers ─────────────────────────────────────────────

    private async getCharacterIds(membershipType: number, destinyId: string): Promise<string[]> {
        const resp = await bungieAPI.apiRequest("getDestinyCharacters", { membershipType, destinyMembershipId: destinyId });
        return ((resp.Response as any).characters as any[]).map(c => c.characterId as string);
    }

    private async fetchAllFresh(
        membershipType: number,
        destinyId:      string,
        chars:          string[],
        hashToKey:      Map<number, string>
    ): Promise<Map<string, number>> {
        const seen    = new Set<string>();
        // key → [{id, period}] — all unique completions found in paged history
        const toCheck = new Map<string, Array<{ id: string; period: number }>>();

        // Phase 1: page all history
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
                        const id        = a.activityDetails.instanceId as string;
                        const refId     = a.activityDetails.referenceId as number;
                        const completed = a.values?.completed?.basic?.value ?? 0;
                        const key       = hashToKey.get(refId);
                        if (completed !== 1 || !key || seen.has(id)) continue;
                        seen.add(id);

                        const period = new Date(a.period as string).getTime();
                        if (!toCheck.has(key)) toCheck.set(key, []);
                        toCheck.get(key)!.push({ id, period });
                    }

                    if (activities.length < 250) break;
                    page++;
                    await sleep(this.pageDelayMs);
                }
                await sleep(this.pageDelayMs);
            }
        }

        // Phase 2: PGCR-check all collected completions
        // History is newest-first; break once fresh count reaches display cap (100).
        const counts = new Map<string, number>();
        for (const [key, completions] of toCheck) {
            let fresh = 0;
            for (const { id, period } of completions) {
                const pgcr = await this.fetchPGCR(id);
                if (pgcr === null || this.isPGCRFresh(pgcr, period)) {
                    if (++fresh >= 100) break;
                }
                await sleep(this.pageDelayMs);
            }
            counts.set(key, fresh);
        }
        return counts;
    }

    private async fetchNewFresh(
        membershipType: number,
        destinyId:      string,
        chars:          string[],
        sinceMs:        number,
        hashToKey:      Map<number, string>
    ): Promise<Map<string, number>> {
        const seen  = new Set<string>();
        const delta = new Map<string, number>();

        for (const charId of chars) {
            for (const mode of [4, 82]) {
                let page = 0;
                outer:
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
                        const period = new Date(a.period as string).getTime();
                        if (period <= sinceMs) break outer;

                        const id        = a.activityDetails.instanceId as string;
                        const refId     = a.activityDetails.referenceId as number;
                        const completed = a.values?.completed?.basic?.value ?? 0;
                        const key       = hashToKey.get(refId);
                        if (completed !== 1 || !key || seen.has(id)) continue;
                        seen.add(id);

                        const pgcr = await this.fetchPGCR(id);
                        if (pgcr === null || this.isPGCRFresh(pgcr, period)) {
                            delta.set(key, (delta.get(key) ?? 0) + 1);
                        }
                        await sleep(this.pageDelayMs);
                    }

                    if (activities.length < 250) break;
                    page++;
                    await sleep(this.pageDelayMs);
                }
                await sleep(this.pageDelayMs);
            }
        }

        return delta;
    }

    // ── PGCR helpers ─────────────────────────────────────────────────────────

    private async fetchPGCR(instanceId: string): Promise<any | null> {
        try {
            const resp = await bungieAPI.apiRequest("getPostGameCarnageReport", { activityId: instanceId });
            return (resp?.Response as any) ?? null;
        } catch {
            return null;
        }
    }

    // Era-aware three-tier detection:
    //   Post-WQ (wasStartedFromBeginning field is reliable):
    //     true  → fresh
    //     false → checkpoint (explicit signal, not a default)
    //     absent → fall through to startingPhaseIndex
    //   Pre-WQ (wasStartedFromBeginning defaulted to false — unreliable):
    //     ignore wasStartedFromBeginning, use startingPhaseIndex only
    private isPGCRFresh(pgcr: any, period: number): boolean {
        if (period >= WITCH_QUEEN_EPOCH) {
            const wasStarted = pgcr.activityWasStartedFromBeginning;
            if (wasStarted === true)  return true;
            if (wasStarted === false) return false;
        }
        // Pre-WQ era or field absent: startingPhaseIndex is reliable
        if ((pgcr.startingPhaseIndex ?? 0) > 0) return false;
        return true;
    }

    // ── DB helpers ───────────────────────────────────────────────────────────

    private async getExistingCounts(discordId: string): Promise<Map<string, number>> {
        const rows = await dbQuery(
            "SELECT activity_key, fresh_count FROM user_fresh_clears WHERE discord_id = ?",
            [discordId]
        );
        const map = new Map<string, number>();
        for (const r of rows) map.set(r.activity_key as string, Number(r.fresh_count));
        return map;
    }

    private async saveCounts(discordId: string, counts: Map<string, number>): Promise<void> {
        const now = Date.now();
        for (const [activityKey, freshCount] of counts) {
            await dbQuery(
                `INSERT INTO user_fresh_clears (discord_id, activity_key, fresh_count, last_updated)
                 VALUES (?,?,?,?)
                 ON DUPLICATE KEY UPDATE fresh_count=?, last_updated=?`,
                [discordId, activityKey, freshCount, now, freshCount, now]
            );
        }
    }
}

export const freshClearService = new FreshClearService();
