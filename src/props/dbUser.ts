export class DBUser {
    bungieId: string;
    destinyId: string;
    membershipType: number;
    stats: Stats;
    raids: RaidObject;
    dungeons: DungeonsObject;
    grandmasters: GrandmastersObject;
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

export class DungeonsObject {
    "Duality": number;
    "Grasp of Avarice": number;
    "Prophecy": number;
    "Pit of Heresy": number;
    "Shattered Throne": number;
    "Presage": number;
    "Harbinger": number;
    "Zero Hour": number;
    "The Whisper": number;
    "Total": number;
}

export class GrandmastersObject {
    "The Glassway": number;
    "The Lightblade": number;
    "Fallen S.A.B.E.R": number;
    "The Disgraced": number;
    "Exodus Crash": number;
    "The Devils Lair": number;
    "Proving Grounds": number;
    "Warden of Nothing": number;
    "The Insight Terminus": number;
    "The Corrupted": number;
    "The Arms Dealer": number;
    "The Inverted Spire": number;
    "Birthplace of the Vile": number;
    "Lake of Shadows": number;
    "The Scarlet Keep": number;

    "Broodhold": number;
    "The Festering Core": number;
    "The Hollowed Lair": number;
    "Savathun's Song": number;
    "Tree of Probabilities": number;
    "Strange Terrain": number;
    "A Garden World": number;
    "Total": number;
}

export class Stats {
    kd: number;
    light: number;
}