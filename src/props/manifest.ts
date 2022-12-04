import {ActivityChallenge, ActivityModifier, ActivityInsertionPoint, RewardItem} from "./activity";
export class ManifestQuery {
    version: string;
    mobileAssetContentPath: string;
    mobileGearAssetDataBases: [ [Object], [Object], [Object] ];
    mobileWorldContentPaths: {
        en: string;
        fr: string;
        es: string;
        'es-mx': string;
        de: string;
        it: string;
        ja: string;
        'pt-br': string;
        ru: string;
        pl: string;
        ko: string;
        'zh-cht': string;
        'zh-chs': string;
    };
    jsonWorldContentPaths: {
        en: string;
        fr: string;
        es: string;
        'es-mx': string;
        de: string;
        it: string;
        ja: string;
        'pt-br': string;
        ru: string;
        pl: string;
        ko: string;
        'zh-cht': string;
        'zh-chs': string;
    };
    jsonWorldComponentContentPaths: {
        en: [Object],
        fr: [Object],
        es: [Object],
        'es-mx': [Object],
        de: [Object],
        it: [Object],
        ja: [Object],
        'pt-br': [Object],
        ru: [Object],
        pl: [Object],
        ko: [Object],
        'zh-cht': [Object],
        'zh-chs': [Object]
    };
    mobileClanBannerDatabasePath: string;
    mobileGearCDN: {
        Geometry: string;
        Texture: string;
        PlateRegion: string;
        Gear: string;
        Shader: string;
    };
    iconImagePyramidInfo: [];
}

export class RawManifestQuery {
    [key: string]: Object;
}

export class ManifestActivityQuery {
    [key: string]: ManifestActivity;
}

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
    destinationHash: number;
    placeHash: number;
    activityTypeHash: number;
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