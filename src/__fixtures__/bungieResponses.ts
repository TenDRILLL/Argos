export const fakeBungieProfile = {
    Response: {
        displayName: "Guardian",
        uniqueName: "Guardian#1234",
        cachedBungieGlobalDisplayName: "Guardian",
        cachedBungieGlobalDisplayNameCode: 1234,
        steamDisplayName: "Guardian",
        xboxDisplayName: null,
        psnDisplayName: null,
        egsDisplayName: null
    },
    ErrorCode: 1,
    ThrottleSeconds: 0,
    ErrorStatus: "Success",
    Message: "Ok"
};

export const fakeAuthResponse = {
    access_token: "fake_access_token",
    expires_in: 3600,
    refresh_token: "fake_refresh_token",
    refresh_expires_in: 7776000,
    membership_id: "987654321098765432",
    token_type: "Bearer"
};

export const fakeCharacterQuery = {
    Response: {
        characters: [
            { characterId: "char1", deleted: false },
            { characterId: "char2", deleted: false }
        ],
        mergedAllCharacters: {
            results: {
                allPvP: {
                    allTime: {
                        killsDeathsRatio: { basic: { value: 1.5 } }
                    }
                }
            },
            merged: {
                allTime: {
                    highestLightLevel: { basic: { value: 1810 } }
                }
            }
        }
    },
    ErrorCode: 1,
    ThrottleSeconds: 0
};

export const fakeActivityStats = {
    Response: {
        activities: [
            { activityHash: 1661734046, values: { activityCompletions: { basic: { value: 5 } } } },
            { activityHash: 2122313384, values: { activityCompletions: { basic: { value: 3 } } } }
        ]
    },
    ErrorCode: 1,
    ThrottleSeconds: 0
};

export const fakeLinkedProfiles = {
    Response: {
        profiles: [
            {
                membershipId: "111222333444555666",
                membershipType: 3,
                isCrossSavePrimary: true
            }
        ]
    },
    ErrorCode: 1,
    ThrottleSeconds: 0
};
