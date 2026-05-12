export interface RaidWeapon {
    name: string;
    type: string;
}

export interface RaidGroup {
    name: string;
    shortName: string;
    weapons: RaidWeapon[];
}

export const RAID_GROUPS: RaidGroup[] = [
    {
        name: "Last Wish",
        shortName: "LW",
        weapons: [
            { name: "Age-Old Bond",    type: "Auto Rifle"    },
            { name: "Nation of Beasts", type: "Hand Cannon"  },
            { name: "Chattering Bone", type: "Pulse Rifle"   },
            { name: "Transfiguration", type: "Scout Rifle"   },
            { name: "Techeun Force",   type: "Fusion Rifle"  },
            { name: "The Supremacy",   type: "Sniper Rifle"  },
        ],
    },
    {
        name: "Garden of Salvation",
        shortName: "GoS",
        weapons: [
            { name: "Reckless Oracle",    type: "Auto Rifle"    },
            { name: "Accrued Redemption", type: "Bow"           },
            { name: "Ancient Gospel",     type: "Hand Cannon"   },
            { name: "Sacred Provenance",  type: "Pulse Rifle"   },
            { name: "Zealot's Reward",    type: "Fusion Rifle"  },
            { name: "Prophet of Doom",    type: "Shotgun"       },
            { name: "Omniscient Eye",     type: "Sniper Rifle"  },
        ],
    },
    {
        name: "Deep Stone Crypt",
        shortName: "DSC",
        weapons: [
            { name: "Posterity",     type: "Hand Cannon"  },
            { name: "Trustee",       type: "Scout Rifle"  },
            { name: "Heritage",      type: "Shotgun"      },
            { name: "Succession",    type: "Sniper Rifle" },
            { name: "Commemoration", type: "Machine Gun"  },
            { name: "Bequest",       type: "Sword"        },
        ],
    },
    {
        name: "Vault of Glass",
        shortName: "VoG",
        weapons: [
            { name: "Fatebringer",        type: "Hand Cannon"     },
            { name: "Vision of Confluence", type: "Scout Rifle"   },
            { name: "Found Verdict",      type: "Shotgun"         },
            { name: "Praedyth's Revenge", type: "Sniper Rifle"    },
            { name: "Corrective Measure", type: "Machine Gun"     },
            { name: "Hezen Vengeance",    type: "Rocket Launcher" },
        ],
    },
    {
        name: "Vow of the Disciple",
        shortName: "VotD",
        weapons: [
            { name: "Insidious",   type: "Pulse Rifle"         },
            { name: "Submission",  type: "Submachine Gun"      },
            { name: "Deliverance", type: "Fusion Rifle"        },
            { name: "Lubrae's Ruin", type: "Glaive"           },
            { name: "Forbearance", type: "Grenade Launcher"    },
            { name: "Cataclysmic", type: "Linear Fusion Rifle" },
        ],
    },
    {
        name: "King's Fall",
        shortName: "KF",
        weapons: [
            { name: "Zaouli's Bane",    type: "Hand Cannon"  },
            { name: "Smite of Merain",  type: "Pulse Rifle"  },
            { name: "Doom of Chelchis", type: "Scout Rifle"  },
            { name: "Midha's Reckoning", type: "Fusion Rifle" },
            { name: "Defiance of Yasmin", type: "Sniper Rifle" },
            { name: "Qullim's Terminus", type: "Machine Gun"  },
        ],
    },
    {
        name: "Root of Nightmares",
        shortName: "RoN",
        weapons: [
            { name: "Rufus's Fury",      type: "Auto Rifle"          },
            { name: "Mykel's Reverence", type: "Sidearm"             },
            { name: "Nessa's Oblation",  type: "Shotgun"             },
            { name: "Koraxis's Distress", type: "Grenade Launcher"   },
            { name: "Acasia's Dejection", type: "Trace Rifle"        },
            { name: "Briar's Contempt",  type: "Linear Fusion Rifle" },
        ],
    },
    {
        name: "Crota's End",
        shortName: "CE",
        weapons: [
            { name: "Abyss Defiant",  type: "Auto Rifle"  },
            { name: "Word of Crota",  type: "Hand Cannon" },
            { name: "Oversoul Edict", type: "Pulse Rifle" },
            { name: "Fang of Ir Yût", type: "Scout Rifle" },
            { name: "Swordbreaker",   type: "Shotgun"     },
            { name: "Song of Ir Yût", type: "Machine Gun" },
        ],
    },
    {
        name: "Salvation's Edge",
        shortName: "SE",
        weapons: [
            { name: "Non-Denouement",      type: "Bow"                  },
            { name: "Nullify",             type: "Pulse Rifle"          },
            { name: "Imminence",           type: "Submachine Gun"       },
            { name: "Forthcoming Deviance", type: "Glaive"             },
            { name: "Critical Anomaly",    type: "Sniper Rifle"         },
            { name: "Summum Bonum",        type: "Sword"                },
        ],
    },
];

export const RAID_NAMES = RAID_GROUPS.map(r => r.name);

export function weaponEmojiName(weaponName: string): string {
    return weaponName.replace(/[^0-9A-z ]/g, "").split(" ").join("_");
}
