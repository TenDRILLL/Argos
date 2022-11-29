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