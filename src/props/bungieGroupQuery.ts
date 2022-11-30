export class BungieGroupQuery {
    results: QueryProfile[];
    totalResults: number;
    hasMore: boolean;
    query: { itemsPerPage: number, currentPage: number; };
    useTotalResults: boolean;
}

export class QueryProfile {
    memberType: number;
    isOnline: boolean;
    lastOnlineStatusChange: string;
    groupId: string;
    destinyUserInfo: DestinyUserInfo;
    bungieNetUserInfo: BungieNetUserInfo;
    joinDate: string;
}

export class DestinyUserInfo {
    LastSeenDisplayName: string;
    LastSeenDisplayNameType: number;
    iconPath: string;
    crossSaveOverride: number;
    applicableMembershipTypes: number[]
    isPublic: boolean;
    membershipType: number;
    membershipId: string;
    displayName: string;
    bungieGlobalDisplayName: string;
    bungieGlobalDisplayNameCode: number;
}

export class BungieNetUserInfo {
    supplementalDisplayName: string;
    iconPath: string;
    crossSaveOverride: number;
    isPublic: boolean;
    membershipType: number;
    membershipId: string;
    displayName: string;
    bungieGlobalDisplayName: string;
    bungieGlobalDisplayNameCode: number;
}