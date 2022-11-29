import internal from "stream"

export class bungieGroupQuery {
    results: QueryProfile[];
    totalResults: number;
    hasMore: boolean;
    query: { itemsPerPage: number, currentPage: number; };
    useTotalResults: boolean
}

export class QueryProfile {
    memberType: number;
    isOnline: boolean;
    lastOnlineStatusChange: string;
    groupId: string;
    destinyUserInfo: destinyUserInfo;
    bungieNetUserInfo: bungieNetUserInfo;
    joinDate: string;
}

export class destinyUserInfo {
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

export class bungieNetUserInfo {
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