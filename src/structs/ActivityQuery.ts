import {BungieNetUserInfo} from "./BungieGroupQuery";

export class ActivityQuery {
    activities: Activity[];
}

export class Activity {
    activityHash: number;
    values: {
        fastestCompletionMsForActivity: ActivityStatWithId;
        activityCompletions: ActivityStat;
        activityDeaths: ActivityStat;
        activityKills: ActivityStat;
        activitySecondsPlayed: ActivityStat;
        activityWins: ActivityStat;
        activityGoalsMissed: ActivityStat;
        activitySpecialActions: ActivityStat;
        activityBestGoalsHit: ActivityStatWithId;
        activityGoalsHit: ActivityStat;
        activitySpecialScore: ActivityStat;
        activityBestSingleGameScore;
        activityKillsDeathRatio: ActivityStat;
        activityAssists: ActivityStat;
        activityKillsDeathsAssists: ActivityStat;
        activityPrecisionKills: ActivityStat;
    };
}

export class ActivityStat {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    };
}

export class ActivityStatWithId {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    };
    activityId: string;
}

export class ActivityInsertionPoint {
    phaseHash: number;
    unlockHash: number;
}

export class ActivityChallenge {
    rewardSiteHash: number;
    inhibiRewardsUnlockHash: number;
    objectiveHash: number;
    dummyRewards: RewardItem[];
}

export class ActivityModifier {
    activityModifierHash: number;
}

export class RewardItem {
    itemHash: number;
    quantity: number;
    hasConditionalVisibility: boolean;
}

export class ActivityHistory {
    activities: DestinyHistoricalStatsPeriod[]
}

export class DestinyHistoricalStatsPeriod {
    period: string;
    activityDetails: ActivityDetails;
    values: Object;
}

export class ActivityDetails {
    referenceId: number;
    directorActivityHash: number;
    instanceId: string;
    mode: number;
    modes: number[];
    isPrivate: boolean;
    membershipType: number
}

export class ActivityValues {
    assists: ActivityStat;
    score: ActivityStat;
    kills: ActivityStat;
    averageScorePerKill: ActivityStat;
    deaths: ActivityStat;
    averageScorePerLife: ActivityStat;
    completed: ActivityStat;
    opponentsDefeated: ActivityStat;
    efficiency: ActivityStat;
    killsDeathsRatio: ActivityStat;
    killsDeathsAssists: ActivityStat;
    activityDurationSeconds: ActivityStat;
    team: ActivityStat;
    completionReason: ActivityStat;
    fireteamId: ActivityStat;
    startSeconds: ActivityStat;
    timePlayedSeconds: ActivityStat;
    playerCount: ActivityStat;
    teamScore: ActivityStat;
}

export class PostGameCarnageReport {
    period: string;
    startingPhaseIndex: number;
    activityWasStartedFromBeginning: boolean;
    activityDetails: ActivityDetails;
    entries: PostGameCarnageReportEntry[];
    teams: {
        teamId: number;
        standing: DestinyHistoricalStatsValue;
        score: DestinyHistoricalStatsValue;
        teamName: string;
    }
}

export class PostGameCarnageReportEntry {
    standing: number;
    score: DestinyHistoricalStatsValue;
    player: Object;
    characterId: number;
    values: DestinyHistoricalStatsValue;
    extended: {
        weapons: WeaponStat[];
        values: DestinyHistoricalStatsValue;
    }
}

export class DestinyHistoricalStatsValue {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    }
    pga: {
        value: number;
        displayValue: string;
    }
    weighted: {
        value: number;
        displayValue: string;
    }
    activityId: number;
}

export class WeaponStat {
    referenceId: number;
    values: DestinyHistoricalStatsValue
}

export class DestinyPlayer {
    destinyUserInfo: BungieNetUserInfo;
    characterClass: string;
    classHash: number;
    raceHash: number;
    genderHash: number;
    characterLevel: number;
    lightLevel: number;
    bungieNetUserInfo: BungieNetUserInfo;
    clanName: string;
    clanTag: string;
    emblemHash: number;
}
