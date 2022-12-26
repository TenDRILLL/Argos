export class DBUser {
    bungieId: string;
    destinyId: string;
    membershipType: number;
    stats: Stats;
    raids: ActivityObject;
    dungeons: ActivityObject;
    grandmasters: ActivityObject;
    roles: string[];
    tokens: {
        accessToken: string;
        accessExpiry: number;
        refreshToken: string;
        refreshExpiry: number;
    };
    discordTokens: {
        accessToken: string;
        expiresIn: number;
        refreshToken: string;
        scope: string;
        tokenType: string;
    };
}

export class ActivityObject {
    [key: string]: number;
}

export class Stats {
    kd: number;
    light: number;
}