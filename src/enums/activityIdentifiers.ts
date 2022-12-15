export const activityIdentifiers = new Map<string, number[]>([
    ["Leviathan",[2693136600,2693136601,2693136602,2693136603,2693136604,2693136605]],
    ["Leviathan, Prestige", [417231112,508802457,757116822,771164842,1685065161,1800508819,2449714930,3446541099,3857338478,3879860661,3912437239,4206123728]],
    ["Leviathan, Eater of Worlds",[3089205900]],
    ["Leviathan, Eater of Worlds, Prestige",[809170886]],
    ["Leviathan, Spire of Stars", [119944200]],
    ["Leviathan, Spire of Stars, Prestige",[3213556450]],
    ["Scourge of the Past",[548750096,2812525063]],
    ["Crown of Sorrow",[960175301,3333172150]],
    ["Last Wish",[2122313384,1661734046]],
    ["Garden of Salvation",[2497200493,2659723068,3458480158,3845997235]],
    ["Deep Stone Crypt",[910380154,3976949817]],
    ["Vault of Glass",[3881495763]],
    ["Vault of Glass, Master",[1681562271]],
    ["Vow of the Disciple",[1441982566]],
    ["Vow of the Disciple, Master",[4217492330]],
    ["King's Fall",[1374392663]],
    ["King's Fall, Master",[2964135793]],

    ["The Glassway", [4197461112, 3812135451]],
    ["The Lightblade", [968885838, 1964120205]],
    ["Fallen S.A.B.E.R.", [3293630132, 676886831]],
    ["The Disgraced", [3381711459, 2136458560]],
    ["Exodus Crash", [54961125, 707920309]],
    ["The Devils' Lair", [1203950592, 2112435491]],
    ["Proving Grounds", [2103025315, 3418624832]],
    ["Warden of Nothing", [3597372938, 3871967157, 4196944364, 38095640, 557845334, 1473557543]],
    ["The Insight Terminus", [554830595, 2694576755, 3029388704, 3200108048]],
    ["The Corrupted", [3354105309, 3100302962, 245243710, 2416314393]],
    ["The Arms Dealer", [3726640183, 1358381372, 1446478334, 1753547901]],
    ["The Inverted Spire", [281497220, 2599001919]],
    ["Birthplace of the Vile", [967120713, 2766844306]],
    ["Lake of Shadows", [3919254032, 1302909043, 3109193568, 207226563]],
    ["The Scarlet Keep", [1495545956, 3449817631]],

    ["Broodhold", [3879949581, 89113250, 135872558, 265186825]],
    ["The Festering Core", [3455414851, 766116576]],
    ["The Hollowed Lair", [283725097, 1561733170]],
    ["Savathûn's Song", [2168858559, 3849697860]],
    ["Tree of Probabilities", [2023667984, 2660931443]],
    ["Strange Terrain", [3883876601]],
    ["A Garden World", [1002842615, 2533203708]],

    ["The Whisper", [74501540, 1099555105]],
    ["Zero Hour", [3232506937, 2731208666]],
    ["Harbinger", [1738383283]],
    ["Presage", [2124066889,4212753278]],
    ["Shattered Throne", [2032534090, 1893059148]],
    ["Pit of Heresy", [2582501063, 785700673, 785700678, 1375089621, 2559374368, 2559374374, 2559374375]],
    ["Prophecy", [1077850348,4148187374]],
    ["Grasp of Avarice", [4078656646, 3774021532]],
    ["Duality", [2823159265, 1668217731]]
]);

export const directActivityModeType = new Map<string, number>([
    ["None", 0],
    ["Story", 2],
    ["Strike", 3],
    ["Raid", 4],
    ["AllPvP", 5],
    ["Patrol", 6],
    ["AllPvE", 7],
    ["Reserved9", 9],
    ["Control", 10],
    ["Reserved11", 11],
    ["Clash", 12],
    ["Reserved13", 13],
    ["CrimsonDoubles", 15],
    ["Nightfall", 16],
    ["HeroicNightfall", 17],
    ["AllStrikes", 18],
    ["IronBanner", 19],
    ["Reserved20", 20],
    ["Reserved21", 21],
    ["Reserved22", 22],
    ["Reserved24", 24],
    ["AllMayhem", 25],
    ["Reserved26", 26],
    ["Reserved27", 27],
    ["Reserved28", 28],
    ["Reserved29", 29],
    ["Reserved30", 30],
    ["Supremacy", 31],
    ["PrivateMatchesAll", 32],
    ["Survival", 37],
    ["Countdown", 38],
    ["TrialsOfTheNine", 39],
    ["Social", 40],
    ["TrialsCountdown", 41],
    ["TrialsSurvival", 42],
    ["IronBannerControl", 43],
    ["IronBannerClash", 44],
    ["IronBannerSupremacy", 45],
    ["ScoredNightfall", 46],
    ["ScoredHeroicNightfall", 47],
    ["Rumble", 48],
    ["AllDoubles", 49],
    ["Doubles", 50],
    ["PrivateMatchesClash", 51],
    ["PrivateMatchesControl", 52],
    ["PrivateMatchesSupremacy", 53],
    ["PrivateMatchesCountdown", 54],
    ["PrivateMatchesSurvival", 55],
    ["PrivateMatchesMayhem", 56],
    ["PrivateMatchesRumble", 57],
    ["HeroicAdventure", 58],
    ["Showdown", 59],
    ["Lockdown", 60],
    ["Scorched", 61],
    ["ScorchedTeam", 62],
    ["Gambit", 63],
    ["AllPvECompetitive", 64],
    ["Breakthrough", 65],
    ["BlackArmoryRun", 66],
    ["Salvage", 67],
    ["IronBannerSalvage", 68],
    ["PvPCompetitive", 69],
    ["PvPQuickplay", 70],
    ["ClashQuickplay", 71],
    ["ClashCompetitive", 72],
    ["ControlQuickplay", 73],
    ["ControlCompetitive", 74],
    ["GambitPrime", 75],
    ["Reckoning", 76],
    ["Menagerie", 77],
    ["VexOffensive", 78],
    ["NightmareHunt", 79],
    ["Elimination", 80],
    ["Momentum", 81],
    ["Dungeon", 82],
    ["Sundial", 83],
    ["TrialsOfOsiris", 84],
    ["Dares", 85],
    ["Offensive", 86],
    ["LostSector", 87],
    ["Rift", 88],
    ["ZoneControl", 89],
    ["IronBannerRift", 90]
]);