export class DBUser {
    bungieId: string;
    destinyId: string;
    destinyName: string;
    membershipType: number;
    inClan: string;
    stats: Stats;
    raids: ActivityObject;
    dungeons: ActivityObject;
    grandmasters: ActivityObject;
    roles: string[];
    timezone: string;
    tokens: {
        accessToken: string;
        accessExpiry: number;
        refreshToken: string;
        refreshExpiry: number;
    };
    discordTokens: {
        accessToken: string;
        accessExpiry: number;
        refreshToken: string;
        scope: string;
        tokenType: string;
    };
    discordUser: {
        id: string;
        username: string;
        avatar: string;
        avatar_decoration: string;
        discriminator: string;
        public_flags: number;
        flags: number;
        banner: string;
        banner_color: string;
        accent_color: number;
        locale: string;
        mfa_enabled: boolean;
        premium_type: number;
    }
}

export class ActivityObject {
    [key: string]: number;
}

export class Stats {
    kd: number;
    light: number;
}

export class partialDBUser {
    destinyId: string;
    membershipType: number;
    stats: Stats;
    raids: ActivityObject;
    dungeons: ActivityObject;
    grandmasters: ActivityObject;
}