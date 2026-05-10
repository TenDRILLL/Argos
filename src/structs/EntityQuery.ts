export class DyeReference {
    channelHash: number;
    dyeHash: number;
}

export class GearArtArrangement {
    classHash: number;
    artArrangementHash: number;
}

export class TranslationBlock {
    weaponPatternHash?: number;
    defaultDyes: DyeReference[];
    lockedDyes: DyeReference[];
    customDyes: DyeReference[];
    arrangements: GearArtArrangement[];
    hasGeometry: boolean;
}

export class EntityQuery {
    displayProperties: DisplayProperties;
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
    inventory: Inventory;
    stats: EntityStats;
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
    translationBlock: TranslationBlock;
    preview: Object[];
    quality: Object[];
    acquireRewardSiteHash: number;
    acquireUnlockHash: number;
    sockets: Socket;
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

export class EntityStats {
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

export class Socket {
    detail: string;
    socketEntries: SocketEntry[];
    intrinsicSockets: IntrinsicSocket[];
    socketCategories: SocketCategory[];
}

export class SocketEntry {
    socketCategoryHash: number;
    socketIndexes: number[];
}

export class IntrinsicSocket {
    plugItemHash: number;
    socketTypeHash: number;
    defaultVisible: boolean;
}

export class SocketCategory {
    socketCategoryHash: number;
    socketIndexes: number[];
}

export class Inventory {
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

export class DisplayProperties {
    description: string;
    name: string;
    icon: string;
    hasIcon: boolean;
}

export class RawEntityQuery {
    [key: string]: EntityQuery;
}
