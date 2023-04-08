import { BungieNetUserInfo } from "./bungieGroupQuery";

export class ActivityQuery {
    activities: Activity[];
}

export class Activity {
    activityHash: number;
    values: {
        fastestCompletionMsForActivity: activityStatWithId;
        activityCompletions: activityStat;
        activityDeaths: activityStat;
        activityKills: activityStat;
        activitySecondsPlayed: activityStat;
        activityWins: activityStat;
        activityGoalsMissed: activityStat;
        activitySpecialActions: activityStat;
        activityBestGoalsHit: activityStatWithId;
        activityGoalsHit: activityStat;
        activitySpecialScore: activityStat;
        activityBestSingleGameScore;
        activityKillsDeathRatio: activityStat;
        activityAssists: activityStat;
        activityKillsDeathsAssists: activityStat;
        activityPrecisionKills: activityStat;
    };
}

export class activityStat {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    };
}

export class activityStatWithId {
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

export class activityHistory {
    activities: DestinyHistoricalStatsPeriod[]
}

export class DestinyHistoricalStatsPeriod {
    period: string;
    activityDetails: activityDetails;
    values: Object;
}

export class activityDetails {
    referenceId: number;
    directorActivityHash: number;
    instanceId: string;
    mode: number;
    modes: number[];
    isPrivate: boolean;
    membershipType: number
}

export class ActivityValues {
    assists: activityStat;
    score: activityStat;
    kills: activityStat;
    averageScorePerKill: activityStat;
    deaths: activityStat;
    averageScorePerLife: activityStat;
    completed: activityStat;
    opponentsDefeated: activityStat;
    efficiency: activityStat;
    killsDeathsRatio: activityStat;
    killsDeathsAssists: activityStat;
    activityDurationSeconds: activityStat;
    team: activityStat;
    completionReason: activityStat;
    fireteamId: activityStat;
    startSeconds: activityStat;
    timePlayedSeconds: activityStat;
    playerCount: activityStat;
    teamScore: activityStat;
}

export class PostGameCarnageReport {
    period: string;
    startingPhaseIndex: number;
    activityWasStartedFromBeginning: boolean;
    activityDetails: activityDetails;
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
        weapons: weaponStat[];
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

export class weaponStat {
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