export class ManifestActivity {
    displayProperties: {
        description: string;
        name: string;
        icon: string;
        hasIcon: boolean;
    };
    originalDisplayProperties: {
        description: string;
        name: string;
        icon: string;
        hasIcon: boolean;
    };
    selectionScreenDisplayProperties: {
        description: string;
        name: string;
        hasIcon: boolean;
    };
    releaseIcon: string;
    releaseTime: number;
    completionUnlockHash: number;
    activityLightLevel: number;
    tier: number;
    pgcrImage: string;
    rewards: {rewardItems: RewardItem[]};
    modifiers: ActivityModifier[];
    isPlaylist: boolean;
    challenges: ActivityChallenge[];
    optionalUnlockStrings: string[];
    inheritFromFreeRoam: boolean;
    suppressOtherRewards: boolean;
    playlistItems: Object[];
    matchmaking: {
        isMatchmade: boolean;
        minParty: number;
        maxParty: number;
        maxPlayers: number;
        requiresGuardianOath: boolean;
    };
    directActivityModeHash: number;
    directActivityModeType: number;
    loadouts: Object[];
    activityModeHashes: number[];
    activityModeTypes: number[];
    isPvP: boolean;
    insertionPoints: ActivityInsertionPoint[];
    activityLocationMappings: Object[];
    hash: number;
    index: number;
    redacted: boolean;
    blacklisted: boolean;
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

export class ManifestActivityQuery {
    data: Map<string,ManifestActivity>;
}

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