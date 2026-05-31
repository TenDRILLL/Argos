import { dbQuery } from "./Database";
import { bungieAPI } from "./BungieAPI";
import { activityIdentifierDB } from "../enums/activityIdentifiers";

const PAGE_DELAY_MS    = 120;
const USER_GAP_MS      = 2_000;
// Bungie added activityWasStartedFromBeginning to PGCRs at Witch Queen launch.
// Pre-WQ PGCRs default the field to false (unreliable); post-WQ false = explicit checkpoint.
const WITCH_QUEEN_EPOCH = new Date("2022-02-22T17:00:00Z").getTime();

// Contest mode end timestamps (exclusive upper bound for day-one detection)
const DAY_ONE_WINDOWS = new Map<string, number>([
    ["Last Wish",           new Date("2018-09-15T17:00:00Z").getTime()],
    ["Garden of Salvation", new Date("2019-10-06T17:00:00Z").getTime()],
    ["Deep Stone Crypt",    new Date("2020-11-22T17:00:00Z").getTime()],
    ["Vault of Glass",      new Date("2021-05-23T17:00:00Z").getTime()],
    ["Vow of the Disciple", new Date("2022-03-07T17:00:00Z").getTime()],
    ["King's Fall",         new Date("2022-08-28T17:00:00Z").getTime()],
    ["Root of Nightmares",  new Date("2023-03-12T17:00:00Z").getTime()],
    ["Crota's End",         new Date("2023-09-03T17:00:00Z").getTime()],
    ["Salvation's Edge",    new Date("2024-06-09T17:00:00Z").getTime()],
]);

export interface FreshClearServiceOptions {
    pageDelayMs?: number;
    userGapMs?:   number;
}

export interface BestSpecial {
    flawless:                 boolean;
    low_man:                  number;   // 0=none, 1=solo, 2=duo, 3=trio
    day_one:                  boolean;
    flawless_low_man:         number;   // best low-man count where also flawless (0=none)
    day_one_flawless:         boolean;
    day_one_flawless_low_man: number;   // best low-man count where day_one+flawless (0=none)
}

export interface FreshClearResult {
    counts:      Map<string, number>;
    specials:    Map<string, BestSpecial>;
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

    async scan(membershipType: number, destinyId: string): Promise<{ counts: Map<string, number>; specials: Map<string, BestSpecial> }> {
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

        const specRows = await dbQuery(
            `SELECT activity_key, flawless, low_man, day_one, flawless_low_man,
                    day_one_flawless, day_one_flawless_low_man
             FROM user_special_clears WHERE discord_id = ?`,
            [discordId]
        );
        const specials = new Map<string, BestSpecial>();
        for (const r of specRows) {
            specials.set(r.activity_key as string, {
                flawless:                 Boolean(r.flawless),
                low_man:                  Number(r.low_man),
                day_one:                  Boolean(r.day_one),
                flawless_low_man:         Number(r.flawless_low_man),
                day_one_flawless:         Boolean(r.day_one_flawless),
                day_one_flawless_low_man: Number(r.day_one_flawless_low_man),
            });
        }
        return { counts, specials, lastUpdated };
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
        const hashToKey        = buildHashToKey();
        const chars            = await this.getCharacterIds(membershipType, destinyId);
        const { counts, specials } = await this.fetchAllFresh(membershipType, destinyId, chars, hashToKey);

        await this.saveCounts(discordId, counts);
        await this.saveSpecials(discordId, specials);
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
    ): Promise<{ counts: Map<string, number>; specials: Map<string, BestSpecial> }> {
        const seen    = new Set<string>();
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
        const counts  = new Map<string, number>();
        const specials = new Map<string, BestSpecial>();
        for (const [key, completions] of toCheck) {
            let fresh = 0;
            const best: BestSpecial = { flawless: false, low_man: 0, day_one: false, flawless_low_man: 0, day_one_flawless: false, day_one_flawless_low_man: 0 };
            for (const { id, period } of completions) {
                const pgcr = await this.fetchPGCR(id);
                if (pgcr === null || this.isPGCRFresh(pgcr, period)) {
                    fresh++;
                    if (pgcr !== null) {
                        const run = this.detectSpecialRun(pgcr, period, key);
                        if (run) this.mergeSpecial(best, run);
                    }
                    if (fresh >= 100) break;
                }
                await sleep(this.pageDelayMs);
            }
            counts.set(key, fresh);
            if (fresh > 0) specials.set(key, best);
        }
        return { counts, specials };
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
            if (wasStarted) return true;
            if (!wasStarted) {
                //true if startingPhaseIndex is 0 or missing
                return (pgcr.startingPhaseIndex ?? 0) <= 0;
            } else {
                //No wasStarted but post-WQ, shouldn't happen but accounting for it just in case.
                return false;
            }
        }
        //true if startingPhaseIndex is 0 or missing
        return (pgcr.startingPhaseIndex ?? 0) <= 0;
    }

    // Returns null when PGCR has no completed entries (can't determine specials)
    private detectSpecialRun(pgcr: any, period: number, key: string): { flawless: boolean; playerCount: number; dayOne: boolean } | null {
        const entries: any[]  = pgcr.entries ?? [];
        const completed       = entries.filter(e => (e.values?.completed?.basic?.value ?? 0) === 1);
        if (!completed.length) return null;

        const dayOneEnd  = DAY_ONE_WINDOWS.get(key);
        const isDayOne   = dayOneEnd !== undefined && period <= dayOneEnd;
        const playerCount = completed.length;
        const totalDeaths = completed.reduce((s: number, e: any) => s + ((e.values?.deaths?.basic?.value) ?? 0), 0);
        return { flawless: totalDeaths === 0, playerCount, dayOne: isDayOne };
    }

    private mergeSpecial(best: BestSpecial, run: { flawless: boolean; playerCount: number; dayOne: boolean }): void {
        const { flawless, playerCount, dayOne } = run;
        const isLowMan = playerCount >= 1 && playerCount <= 3;
        if (flawless) best.flawless = true;
        if (isLowMan && (best.low_man === 0 || playerCount < best.low_man)) best.low_man = playerCount;
        if (dayOne) best.day_one = true;
        if (flawless && isLowMan && (best.flawless_low_man === 0 || playerCount < best.flawless_low_man)) best.flawless_low_man = playerCount;
        if (dayOne && flawless) best.day_one_flawless = true;
        if (dayOne && flawless && isLowMan && (best.day_one_flawless_low_man === 0 || playerCount < best.day_one_flawless_low_man)) best.day_one_flawless_low_man = playerCount;
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

    private async saveSpecials(discordId: string, specials: Map<string, BestSpecial>): Promise<void> {
        const now = Date.now();
        for (const [activityKey, s] of specials) {
            await dbQuery(
                `INSERT INTO user_special_clears
                 (discord_id, activity_key, flawless, low_man, day_one, flawless_low_man, day_one_flawless, day_one_flawless_low_man, last_updated)
                 VALUES (?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                 flawless=?, low_man=?, day_one=?, flawless_low_man=?, day_one_flawless=?, day_one_flawless_low_man=?, last_updated=?`,
                [
                    discordId, activityKey,
                    s.flawless ? 1 : 0, s.low_man, s.day_one ? 1 : 0,
                    s.flawless_low_man, s.day_one_flawless ? 1 : 0, s.day_one_flawless_low_man, now,
                    s.flawless ? 1 : 0, s.low_man, s.day_one ? 1 : 0,
                    s.flawless_low_man, s.day_one_flawless ? 1 : 0, s.day_one_flawless_low_man, now,
                ]
            );
        }
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
