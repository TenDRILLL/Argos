export class entityQuery{
    displayProperties: displayProperties;
    tooltipNotifications: Object[];
    collectibleHash: number;
    iconWatermark: string;
    iconWatermarkShelved: string;
    backgroundColor: Object[];
    screenshot: string;
    itemTypeDisplayName: string;
    flavorText: string;
    uiItemDisplayStyle: string;
    itemTypeAndTierDisplayName: string;
    displaySource: string;
    action: Object[];
    inventory: inventory;
    stats: entityStats;
    equippingBlock: {
        uniqueLabel: string;
        uniqueLabelHash: number;
        equipmentSlotTypeHash: number;
        attributes: number;
        equippingSoundHash: number;
        hornSoundHash: number;
        ammoType: number;
        displayStrings: string[];
    };
    translationBlock: Object[];
    preview: Object[];
    quality: Object[];
    acquireRewardSiteHash: number;
    acquireUnlockHash: number;
    sockets: socket;
    talentGrid: Object[];
    investmentStats: Object[];
    perks: [];
    loreHash: number;
    summaryItemHash: number;
    allowActions: true;
    doesPostmasterPullHaveSideEffects: boolean;
    nonTransferrable: boolean;
    itemCategoryHashes: Object[];
    specialItemType: number;
    itemType: number;
    itemSubType: number;
    classType: number;
    breakerType: number;
    equippable: boolean;
    damageTypeHashes: Object[];
    damageTypes: Object[];
    defaultDamageType: number;
    defaultDamageTypeHash: number;
    isWrapper: boolean;
    traitIds: Object[];
    traitHashes: Object[];
    hash: number;
    index: number;
    redacted: boolean;
    blacklisted: boolean;
}

export class entityStats {
    disablePrimaryStatDisplay: boolean;
    statGroupHash: number;
    stats: {
        [key: number]: {
            statHash: number;
            value: number;
            minimum: number;
            maximum: number;
            displayMaximum: number | null;
        }
    }
    hasDisplayableStats: boolean;
    primaryBaseStatHash: number;
}

export class socket {
    detail: string;
    socketEntries: socketEntry[];
    intrinsicSockets: intrinsicSocket[];
    socketCategories: socketCategory[];
}

export class socketEntry {
    socketCategoryHash: number;
    socketIndexes: number[];
}

export class intrinsicSocket {
    plugItemHash: number;
    socketTypeHash: number;
    defaultVisible: boolean;
}

export class socketCategory {
    socketCategoryHash: number;
    socketIndexes: number[];
}

export class inventory {
    maxStackSize: number;
    bucketTypeHash: number;
    recoveryBucketTypeHash: number;
    tierTypeHash: number;
    isInstanceItem: boolean;
    nonTransferrableOriginal: boolean;
    tierTypeName: string;
    tierType: number;
    expirationTooltip: string;
    expiredInActivityMessage: string;
    expiredInOrbitMessage: string;
    suppressExpirationWhenObjectivesComplete: boolean;
}

export class displayProperties {
    description: string;
    name: string;
    icon: string;
    hasIcon: boolean;
};