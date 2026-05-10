export class DBUser {
    discord_id: string;
    bungie_id: string;
    destiny_id: string;
    destiny_name: string;
    membership_type: number;
    in_clan: string;
    guardian_rank: number;
    timezone: string;
    stats_kd: number;
    stats_light: number;
}

export class ActivityObject {
    [key: string]: number;
}

export class Stats {
    kd: number;
    light: number;
}

export class PartialDBUser {
    destinyId: string;
    membershipType: number;
    stats: Stats;
    raids: ActivityObject;
    dungeons: ActivityObject;
    grandmasters: ActivityObject;
}

export interface UserStats {
    discord_id: string;
    bungie_id: string;
    destiny_name: string;
    destiny_id: string;
    membership_type: number;
    in_clan: string;
    guardian_rank: number;
    stats: Stats;
    raids: ActivityObject;
    dungeons: ActivityObject;
    grandmasters: ActivityObject;
}
