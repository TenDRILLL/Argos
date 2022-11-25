export class DBUser {
    bungieId: string;
    destinyId: string;
    membershipType: number;
    stats: Stats;
    raids: RaidObject;
}

export class RaidObject {
    "Crown of Sorrow": number;
    "Deep Stone Crypt": number;
    "Garden of Salvation": number;
    "King's Fall, Legend": number;
    "King's Fall, Master": number;
    "Last Wish": number;
    "Leviathan, Eater of Worlds, Normal": number;
    "Leviathan, Eater of Worlds, Prestige": number;
    "Leviathan, Spire of Stars, Normal": number;
    "Leviathan, Spire of Stars, Prestige": number;
    "Leviathan, Normal": number;
    "Leviathan, Prestige": number;
    "Scourge of the Past": number;
    "Vault of Glass, Master": number;
    "Vault of Glass, Normal": number;
    "Vow of the Disciple, Master": number;
    "Vow of the Disciple, Normal": number;
    "Total": number;
}

export class Stats {
    kd: number;
    light: number;
}