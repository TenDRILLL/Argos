import { ActivityIdentifierObject } from "../structs/ActivityIdentifierObject";

const rawIdentifiers = new Map<string, number[]>([
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
    ["Root of Nightmares", [2381413764]],
    ["Crota's End", [4179289725]],

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

    ["The Whisper", [74501540]],
    ["The Whisper, Heroic", [1099555105]],
    ["Zero Hour", [3232506937]],
    ["Zero Hour, Heroic", [2731208666]],
    ["Harbinger", [1738383283]],
    ["Presage", [2124066889]],
    ["Presage, Master", [4212753278]],
    ["The Shattered Throne", [2032534090, 1893059148]],
    ["Pit of Heresy", [2582501063, 785700673, 785700678, 1375089621, 2559374368, 2559374374, 2559374375]],
    ["Prophecy", [1077850348,4148187374]],
    ["Grasp of Avarice", [4078656646]],
    ["Duality", [2823159265]],
    ["Warlord's Ruin", [2004855007]]
]);

function buildActivityIdentifierDB(): Map<string, ActivityIdentifierObject> {
    const db = new Map<string, ActivityIdentifierObject>();
    const masterTest = /Master/;
    const prestigeTest = /Prestige/;
    const heroicTest = /Heroic/;
    let i = 0;
    for (const [originalKey, ids] of rawIdentifiers) {
        const type = i <= 18 ? 0 : (i <= 40 ? 2 : 1);
        let key = originalKey;
        if (masterTest.test(key) || prestigeTest.test(key) || heroicTest.test(key)) {
            key = key.substring(0, key.lastIndexOf(","));
        }
        const saved: ActivityIdentifierObject = db.get(key) ?? { IDs: [], type, difficultName: "", difficultIDs: [] };
        if (masterTest.test(originalKey)) {
            saved.difficultName = "Master";
            ids.forEach(id => saved.difficultIDs.push(id));
        }
        if (prestigeTest.test(originalKey)) {
            saved.difficultName = "Prestige";
            ids.forEach(id => saved.difficultIDs.push(id));
        }
        if (heroicTest.test(originalKey)) {
            saved.difficultName = "Heroic";
            ids.forEach(id => saved.difficultIDs.push(id));
        }
        ids.forEach(id => { if (!saved.IDs.includes(id)) saved.IDs.push(id); });
        db.set(key, saved);
        i++;
    }
    return db;
}

export const activityIdentifierDB = buildActivityIdentifierDB();
