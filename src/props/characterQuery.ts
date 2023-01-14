export class CharacterQuery {
    mergedDeletedCharacters: Object;
    mergedAllCharacters: MergedAllCharacters;
    characters: Character[];
}

export class Character {
    characterId: string;
    deleted: boolean;
    results: Object;
    merged: Object;
}

export class MergedAllCharacters {
    results: { allPvE: { allTime: PvEStats }, allPvP: { allTime: PvPStats } };
    merged: {
      allTime: MergedStats
    }
  }

export class PvPStats {
    activitiesEntered: CharacterStat;
    activitiesWon: CharacterStat;
    assists: CharacterStatWithPGA;
    totalDeathDistance: CharacterStat;
    averageDeathDistance: CharacterStat;
    totalKillDistance: CharacterStat;
    kills: CharacterStatWithPGA;
    averageKillDistance: CharacterStat;
    secondsPlayed: CharacterStatWithPGA;
    deaths: CharacterStatWithPGA;
    averageLifespan: CharacterStat;
    score: CharacterStatWithPGA;
    averageScorePerKill: CharacterStat;
    averageScorePerLife: CharacterStat;
    bestSingleGameKills: CharacterStat;
    bestSingleGameScore: CharacterStat;
    opponentsDefeated: CharacterStat;
    efficiency: CharacterStat;
    killsDeathsRatio: CharacterStat;
    killsDeathsAssists: CharacterStat;
    objectivesCompleted: CharacterStatWithPGA;
    precisionKills: CharacterStatWithPGA;
    resurrectionsPerformed: CharacterStatWithPGA;
    resurrectionsReceived: CharacterStatWithPGA;
    suicides: CharacterStatWithPGA;
    weaponKillsAutoRifle: CharacterStatWithPGA;
    weaponKillsBeamRifle: CharacterStatWithPGA;
    weaponKillsBow: CharacterStatWithPGA;
    weaponKillsGlaive: CharacterStatWithPGA;
    weaponKillsFusionRifle: CharacterStatWithPGA;
    weaponKillsHandCannon: CharacterStatWithPGA;
    weaponKillsTraceRifle: CharacterStatWithPGA;
    weaponKillsMachineGun: CharacterStatWithPGA;
    weaponKillsPulseRifle: CharacterStatWithPGA;
    weaponKillsRocketLauncher: CharacterStatWithPGA;
    weaponKillsScoutRifle: CharacterStatWithPGA;
    weaponKillsShotgun: CharacterStatWithPGA;
    weaponKillsSniper: CharacterStatWithPGA;
    weaponKillsSubmachinegun: CharacterStatWithPGA;
    weaponKillsRelic: CharacterStatWithPGA;
    weaponKillsSideArm: CharacterStatWithPGA;
    weaponKillsSword: CharacterStatWithPGA;
    weaponKillsAbility: CharacterStatWithPGA;
    weaponKillsGrenade: CharacterStatWithPGA;
    weaponKillsGrenadeLauncher: CharacterStatWithPGA;
    weaponKillsSuper: CharacterStatWithPGA;
    weaponKillsMelee: CharacterStatWithPGA;
    weaponBestType: CharacterStat;
    winLossRatio: CharacterStat;
    allParticipantsCount: CharacterStat;
    allParticipantsScore: CharacterStat;
    allParticipantsTimePlayed: CharacterStat;
    longestKillSpree: CharacterStat;
    longestSingleLife: CharacterStat;
    mostPrecisionKills: CharacterStat;
    orbsDropped: CharacterStatWithPGA;
    orbsGathered: CharacterStatWithPGA;
    remainingTimeAfterQuitSeconds: CharacterStatWithPGA;
    teamScore: CharacterStatWithPGA;
    totalActivityDurationSeconds: CharacterStatWithPGA;
    combatRating: CharacterStat;
    fastestCompletionMs: CharacterStat;
    longestKillDistance: CharacterStat;
    highestCharacterLevel: CharacterStat;
    highestLightLevel: CharacterStat;
    fireTeamActivities: CharacterStat;
}

export class PvEStats {
    activitiesCleared: CharacterStat;
    activitiesEntered: CharacterStat;
    assists: CharacterStatWithPGA;
    totalDeathDistance: CharacterStat;
    averageDeathDistance: CharacterStat;
    totalKillDistance: CharacterStat;
    kills: CharacterStatWithPGA;
    averageKillDistance: CharacterStat;
    secondsPlayed: CharacterStatWithPGA;
    deaths: CharacterStatWithPGA;
    averageLifespan: CharacterStat;
    bestSingleGameKills: CharacterStat;
    bestSingleGameScore: CharacterStat;
    opponentsDefeated: CharacterStat;
    efficiency: CharacterStat;
    killsDeathsRatio: CharacterStat;
    killsDeathsAssists: CharacterStat;
    objectivesCompleted: CharacterStatWithPGA;
    precisionKills: CharacterStatWithPGA;
    resurrectionsPerformed: CharacterStatWithPGA;
    resurrectionsReceived: CharacterStatWithPGA;
    score: CharacterStatWithPGA;
    heroicPublicEventsCompleted: CharacterStatWithPGA;
    adventuresCompleted: CharacterStatWithPGA;
    suicides: CharacterStatWithPGA;
    weaponKillsAutoRifle: CharacterStatWithPGA;
    weaponKillsBeamRifle: CharacterStatWithPGA;
    weaponKillsBow: CharacterStatWithPGA;
    weaponKillsGlaive: CharacterStatWithPGA;
    weaponKillsFusionRifle: CharacterStatWithPGA;
    weaponKillsHandCannon: CharacterStatWithPGA;
    weaponKillsTraceRifle: CharacterStatWithPGA;
    weaponKillsMachineGun: CharacterStatWithPGA;
    weaponKillsPulseRifle: CharacterStatWithPGA;
    weaponKillsRocketLauncher: CharacterStatWithPGA;
    weaponKillsScoutRifle: CharacterStatWithPGA;
    weaponKillsShotgun: CharacterStatWithPGA;
    weaponKillsSniper: CharacterStatWithPGA;
    weaponKillsSubmachinegun: CharacterStatWithPGA;
    weaponKillsRelic: CharacterStatWithPGA;
    weaponKillsSideArm: CharacterStatWithPGA;
    weaponKillsSword: CharacterStatWithPGA;
    weaponKillsAbility: CharacterStatWithPGA;
    weaponKillsGrenade: CharacterStatWithPGA;
    weaponKillsGrenadeLauncher: CharacterStatWithPGA;
    weaponKillsSuper: CharacterStatWithPGA;
    weaponKillsMelee: CharacterStatWithPGA;
    weaponBestType: CharacterStat;
    allParticipantsCount: CharacterStat;
    allParticipantsScore: CharacterStat;
    allParticipantsTimePlayed: CharacterStat;
    longestKillSpree: CharacterStat;
    longestSingleLife: CharacterStat;
    mostPrecisionKills: CharacterStat;
    orbsDropped: CharacterStatWithPGA;
    orbsGathered: CharacterStatWithPGA;
    publicEventsCompleted: CharacterStatWithPGA;
    remainingTimeAfterQuitSeconds: CharacterStatWithPGA;
    teamScore: CharacterStatWithPGA;
    totalActivityDurationSeconds: CharacterStatWithPGA;
    fastestCompletionMs: CharacterStat;
    longestKillDistance: CharacterStat;
    highestCharacterLevel: CharacterStat;
    highestLightLevel: CharacterStat;
    fireTeamActivities: CharacterStat;
    allTime: [Object]
}

export class MergedStats {
    activitiesCleared: CharacterStat;
    activitiesEntered: CharacterStat;
    assists: CharacterStatWithPGA;
    totalDeathDistance: CharacterStat;
    averageDeathDistance: CharacterStat;
    totalKillDistance: CharacterStat;
    kills: CharacterStatWithPGA;
    averageKillDistance: CharacterStat;
    secondsPlayed: CharacterStatWithPGA;
    deaths: CharacterStatWithPGA;
    averageLifespan: CharacterStat;
    bestSingleGameKills: CharacterStat;
    bestSingleGameScore: CharacterStat;
    opponentsDefeated: CharacterStat;
    efficiency: CharacterStat;
    killsDeathsRatio: CharacterStat;
    killsDeathsAssists: CharacterStat;
    objectivesCompleted: CharacterStatWithPGA;
    precisionKills: CharacterStatWithPGA;
    resurrectionsPerformed: CharacterStatWithPGA;
    resurrectionsReceived: CharacterStatWithPGA;
    score: CharacterStatWithPGA;
    heroicPublicEventsCompleted: CharacterStatWithPGA;
    adventuresCompleted: CharacterStatWithPGA;
    suicides: CharacterStatWithPGA;
    weaponKillsAutoRifle: CharacterStatWithPGA;
    weaponKillsBeamRifle: CharacterStatWithPGA;
    weaponKillsBow: CharacterStatWithPGA;
    weaponKillsGlaive: CharacterStatWithPGA;
    weaponKillsFusionRifle: CharacterStatWithPGA;
    weaponKillsHandCannon: CharacterStatWithPGA;
    weaponKillsTraceRifle: CharacterStatWithPGA;
    weaponKillsMachineGun: CharacterStatWithPGA;
    weaponKillsPulseRifle: CharacterStatWithPGA;
    weaponKillsRocketLauncher: CharacterStatWithPGA;
    weaponKillsScoutRifle: CharacterStatWithPGA;
    weaponKillsShotgun: CharacterStatWithPGA;
    weaponKillsSniper: CharacterStatWithPGA;
    weaponKillsSubmachinegun: CharacterStatWithPGA;
    weaponKillsRelic: CharacterStatWithPGA;
    weaponKillsSideArm: CharacterStatWithPGA;
    weaponKillsSword: CharacterStatWithPGA;
    weaponKillsAbility: CharacterStatWithPGA;
    weaponKillsGrenade: CharacterStatWithPGA;
    weaponKillsGrenadeLauncher: CharacterStatWithPGA;
    weaponKillsSuper: CharacterStatWithPGA;
    weaponKillsMelee: CharacterStatWithPGA;
    weaponBestType: CharacterStat;
    allParticipantsCount: CharacterStat;
    allParticipantsScore: CharacterStat;
    allParticipantsTimePlayed: CharacterStat;
    longestKillSpree: CharacterStat;
    longestSingleLife: CharacterStat;
    mostPrecisionKills: CharacterStat;
    orbsDropped: CharacterStatWithPGA;
    orbsGathered: CharacterStatWithPGA;
    publicEventsCompleted: CharacterStatWithPGA;
    remainingTimeAfterQuitSeconds: CharacterStatWithPGA;
    teamScore: CharacterStatWithPGA;
    totalActivityDurationSeconds: CharacterStatWithPGA;
    fastestCompletionMs: CharacterStat;
    longestKillDistance: CharacterStat;
    highestCharacterLevel: CharacterStat;
    highestLightLevel: CharacterStat;
    fireTeamActivities: CharacterStat;
    activitiesWon: CharacterStat;
    averageScorePerKill: CharacterStat;
    averageScorePerLife: CharacterStat;
    winLossRatio: CharacterStat;
    combatRating: CharacterStat;
  }

export class CharacterStat {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    };
}

export class CharacterStatWithPGA {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    }
    pga: {
        value: number;
        displayValue: string;
    };
}

export class characterInventoryQuery {
    inventory: {
        data: {
            items: Object[];
        }
        privacy: number;
    };
    character: {
        data: {
            membershipId: string;
            msPlayedThisSession: string;
            minutesPlayedTotal: string;
            light: number;
            stats: statObject;
            raceHash: number;
            genderHash: number;
            classHash: number;
            raceType: number;
            classType: number;
            genderTembershipType: number;
            characterId: string;
            dateLastPlayed: string;
            minuteype: number;
            emblemPath: string;
            emblemBackgroundPath: string;
            emblemHash: number;
            emblemColor: Object[];
            levelProgression: Object[];
            baseCharacterLevel: number;
            percentToNextLevel: number;
            titleRecordHash: number;
        }
        privacy: number;
    };
    equipment: Object;
    uninstancedItemComponents: number[];
}

export class statObject {
    [key: string]: number;
}

export class invetoryItem {
    itemHash: number;
    itemInstanceId: string;
    quantity: number;
    bindStatus: number;
    location: number;
    bucketHash: number;
    transferStatus: number;
    lockable: boolean;
    state: number;
    dismantlePermission: number;
    isWrapper: boolean;
}