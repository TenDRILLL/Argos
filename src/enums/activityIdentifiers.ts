import { ActivityIdentifierObject } from "../structs/ActivityIdentifierObject";

const rawIdentifiers = new Map<string, number[]>([
    ["Leviathan",[2693136600,2693136601,2693136602,2693136603,2693136604,2693136605,89727599,287649202,1699948563,1875726950,3916343513,4039317196]],
    ["Leviathan, Prestige", [417231112,508802457,757116822,771164842,1685065161,1800508819,2449714930,3446541099,3857338478,3879860661,3912437239,4206123728]],
    ["Leviathan, Eater of Worlds",[3089205900,2164432138]],
    ["Leviathan, Eater of Worlds, Prestige",[809170886]],
    ["Leviathan, Spire of Stars", [119944200,3004605630]],
    ["Leviathan, Spire of Stars, Prestige",[3213556450]],
    ["Scourge of the Past",[548750096,2812525063]],
    ["Crown of Sorrow",[960175301,3333172150]],
    ["Last Wish",[2122313384,1661734046,2214608156,2214608157]],
    ["Garden of Salvation",[2497200493,2659723068,3458480158,3845997235,1042180643]],
    ["Deep Stone Crypt",[910380154,3976949817]],
    ["Vault of Glass",[3881495763,1485585878]],
    ["Vault of Glass, Master",[1681562271,3022541210]],
    ["Vow of the Disciple",[1441982566,2906950631]],
    ["Vow of the Disciple, Master",[4217492330,3889634515]],
    ["King's Fall",[1374392663,1063970578]],
    ["King's Fall, Master",[2964135793,3257594522]],
    ["Root of Nightmares", [2381413764]],
    ["Root of Nightmares, Master", [2918919505]],
    ["Crota's End", [4179289725,107319834,1566480315,156253568]],
    ["Crota's End, Master", [1507509200]],
    ["Salvation's Edge", [2192826039, 1541433876, 940375169]],
    ["Salvation's Edge, Master", [4129614942]],
    ["The Desert Perpetual", [1044919065, 3896382790]],
    ["The Desert Perpetual, Epic", [3817322389, 2586252122]],
    ["The Pantheon", [4169648176,4169648177,4169648179,4169648182]],

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
    ["Battleground: Behemoth", [8957763]],
    ["Battleground: Foothold", [3580217919]],
    ["Battleground: Hailstone", [798920782]],
    ["Battleground: Oracle", [284866935]],
    ["Defiant Battleground: Cosmodrome", [3640623961]],
    ["Defiant Battleground: EDZ", [952545351]],
    ["Defiant Battleground: Orbital Prison", [2619900708]],
    ["Heist Battleground: Europa", [247753793]],
    ["Heist Battleground: Mars", [446038093]],
    ["Heist Battleground: Moon", [3181063546]],
    ["HyperNet Current", [2082796332, 2389570605]],
    ["Liminality", [1700470403]],
    ["The Sunless Cell", [2438990097]],
    ["PsiOps Battleground: EDZ", [2944405548]],
    ["PsiOps Battleground: Moon", [3410113364]],

    ["The Whisper", [74501540]],
    ["The Whisper, Heroic", [1099555105]],
    ["Zero Hour", [3232506937]],
    ["Zero Hour, Heroic", [2731208666]],
    ["Harbinger", [1738383283]],
    ["Presage", [2124066889]],
    ["Presage, Master", [4212753278]],
    ["The Shattered Throne", [2032534090, 1893059148]],
    ["Pit of Heresy", [2582501063, 785700673, 785700678, 1375089621, 2559374368, 2559374374, 2559374375]],
    ["Prophecy", [1077850348,4148187374,715153594]],
    ["Grasp of Avarice", [4078656646]],
    ["Grasp of Avarice, Master", [1112917203,3774021532]],
    ["Duality", [2823159265]],
    ["Duality, Master", [1668217731,3012587626]],
    ["Warlord's Ruin", [2004855007]],
    ["Warlord's Ruin, Master", [2534833093]],
    ["Spire of the Watcher", [1262462921,3339002067,4046934917]],
    ["Spire of the Watcher, Master", [2296818662,1801496203]],
    ["Ghosts of the Deep", [313828469,124340010,2961030534]],
    ["Ghosts of the Deep, Master", [2716998124]],
    ["Vesper's Host", [300092127, 1915770060, 3492566689]],
    ["Vesper's Host, Master", [4293676253]],
    ["Sundered Doctrine", [3834447244, 247869137]],
    ["Sundered Doctrine, Master", [3521648250]],
    ["Equilibrium", [2727361621]],
    ["Equilibrium, Contest", [1754635208]],
]);

function buildActivityIdentifierDB(): Map<string, ActivityIdentifierObject> {
    const db = new Map<string, ActivityIdentifierObject>();
    const masterTest = /Master/;
    const prestigeTest = /Prestige/;
    const heroicTest = /Heroic/;
    let i = 0;
    for (const [originalKey, ids] of rawIdentifiers) {
        const type = i <= 25 ? 0 : (i <= 62 ? 2 : 1);
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

const MODE_RAID      = 4;
const MODE_DUNGEON   = 82;
const MODE_NIGHTFALL = 46;
const GM_LIGHT_FLOOR = 1580; //Bump if new GMs missing
const DIFFICULT_TEST = /,\s*(Master|Prestige|Heroic|Contest|Epic)$/;

export interface ManifestNewEntry {
    name: string;
    type: 0 | 1 | 2;
    IDs: number[];
    difficultName: string;
    difficultIDs: number[];
}

export function buildFromManifest(defs: Record<string, any>): { raids: number; dungeons: number; gms: number; newEntries: ManifestNewEntry[] } {
    // seed from static rawIdentifiers so historical activities (e.g. sunset raids) are never lost
    const next = buildActivityIdentifierDB();
    const staticKeys = new Set(next.keys());

    for (const def of Object.values(defs)) {
        const modes: number[]     = def.activityModeTypes ?? [];
        const name: string        = def.displayProperties?.name ?? "";
        const hash: number        = def.hash;
        const isPlaylist: boolean = def.isPlaylist ?? true;
        const lightLevel: number  = def.activityLightLevel ?? 0;

        if (!name || isPlaylist) continue;

        let type: number;
        if      (modes.includes(MODE_RAID))                                      type = 0;
        else if (modes.includes(MODE_DUNGEON))                                   type = 1;
        else if (modes.includes(MODE_NIGHTFALL) && lightLevel >= GM_LIGHT_FLOOR) type = 2;
        else continue;

        const match     = name.match(DIFFICULT_TEST);
        const baseKey   = match ? name.substring(0, name.lastIndexOf(",")).trim() : name;
        const difficult = match?.[1] ?? null;

        const entry = next.get(baseKey) ?? { IDs: [], type, difficultName: "", difficultIDs: [] };
        if (difficult) {
            entry.difficultName = difficult;
            if (!entry.difficultIDs.includes(hash)) entry.difficultIDs.push(hash);
        } else {
            if (!entry.IDs.includes(hash)) entry.IDs.push(hash);
        }
        next.set(baseKey, entry);
    }

    activityIdentifierDB.clear();
    for (const [k, v] of next) activityIdentifierDB.set(k, v);

    const newEntries: ManifestNewEntry[] = [];
    let raids = 0, dungeons = 0, gms = 0;
    for (const [key, v] of activityIdentifierDB) {
        if      (v.type === 0) raids++;
        else if (v.type === 1) dungeons++;
        else                   gms++;
        if (!staticKeys.has(key)) newEntries.push({ name: key, type: v.type as 0 | 1 | 2, IDs: v.IDs, difficultName: v.difficultName, difficultIDs: v.difficultIDs });
    }
    return { raids, dungeons, gms, newEntries };
}
