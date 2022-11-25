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