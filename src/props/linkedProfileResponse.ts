export class LinkedProfileResponse {
    profiles: LinkedProfile[];
    bnetMembership: {
        supplementalDisplayName: string;
        iconPath: string;
        crossSaveOverride: number;
        isPublic: boolean;
        membershipType: number;
        membershipId: string;
        displayName: string;
        bungieGlobalDisplayName: string;
        bungieGlobalDisplayNameCode: number;
    };
    profilesWithErrors: Object[];
}

export class LinkedProfile {
    dateLastPlayed: string;
    isOverridden: boolean;
    isCrossSavePrimary: boolean;
    crossSaveOverride: number;
    applicableMembershipTypes: number[];
    isPublic: boolean;
    membershipType: number;
    membershipId: string;
    displayName: string;
    bungieGlobalDisplayName: string;
    bungieGlobalDisplayNameCode: number;
}