import enmap from "enmap";
import { activityIdentifiers } from "../enums/activityIdentifiers";
import { activityIdentifierObject } from "../props/activityIdentifierObject";
import { ManifestActivity, ManifestQuery, RawManifestQuery } from "../props/manifest";

function normalizeActivityName(raidName) {
    const parts: string[] = raidName.split(":");
    return parts[0];
}

export function updateActivityIdentifierDB(d2client) {
    d2client.apiRequest("getManifests",{}).then(d => {
        const resp = d.Response as ManifestQuery;
        const enManifest = resp.jsonWorldComponentContentPaths.en["DestinyActivityDefinition"];
        const MasterTest = new RegExp(/Master/g);
        const PrestigeTest = new RegExp(/Prestige/g);
        const HeroicTest = new RegExp(/Heroic/g);
        d2client.rawRequest(`https://www.bungie.net${enManifest}`).then(e => {
            Object.values(e as unknown as RawManifestQuery).forEach(x => {
                const activity = x as ManifestActivity;      
                const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.name) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                if (MasterTest.test(activity.displayProperties.name)) { //Check if name contains Master
                    saved.difficultName = "Master";
                    saved.difficultIDs.push(activity.hash);
                    }
                else if (PrestigeTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Prestige";
                    saved.difficultIDs.push(activity.hash);
                }
                else if (HeroicTest.test(activity.displayProperties.name)) { //Check if name contains Prestige
                    saved.difficultName = "Heroic";
                    saved.difficultIDs.push(activity.hash);
                }
                if (608898761/*dungeon*/ === activity.activityTypeHash) {
                    saved.type = 1;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved);
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            d2client.entityDB.set("activityOrder", temp);
                        }
                }
                } else if (2043403989/*raid*/ === activity.activityTypeHash) {
                    saved.type = 0;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(normalizeActivityName(activity.displayProperties.name), saved); 
                        if (!d2client.entityDB.get("activityOrder").includes(normalizeActivityName(activity.displayProperties.name))) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(normalizeActivityName(activity.displayProperties.name));
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                } else if (new RegExp(/Grandmaster/gi).test(activity.displayProperties.name) && activity.displayProperties.description != "Grandmaster" && !(activity.displayProperties.description != "Nightfall: Grandmaster")) {
                    const saved = d2client.activityIdentifierDB.get(activity.originalDisplayProperties.description) as activityIdentifierObject ?? {IDs: [], type: 0, difficultName: "", difficultIDs: []};
                    saved.type = 2;
                    if (!saved.IDs.includes(activity.hash)) {
                        saved.IDs.push(activity.hash);
                        d2client.activityIdentifierDB.set(activity.displayProperties.description, saved);
                        if (!d2client.entityDB.get("activityOrder").includes(activity.originalDisplayProperties.description)) {
                            const temp = d2client.entityDB.get("activityOrder");
                            temp.push(activity.originalDisplayProperties.description);
                            console.log(`Added ${activity.displayProperties.name} to activityOrder`);
                            d2client.entityDB.set("activityOrder", temp);
                        }
                    }
                }
            })
        });    
    }).catch(e => console.log(20));
}

export function instantiateActivityDatabase(d2client) {
    const iterator = activityIdentifiers.keys()
    d2client.activityIdentifierDB.deleteAll();
    d2client.activityIdentifierDB = new enmap({name: "activityIdentifiers"});
    d2client.entityDB.delete("activityOrder");
    d2client.entityDB.set("activityOrder",[]);
    const MasterTest = new RegExp(/Master/);
    const PrestigeTest = new RegExp(/Prestige/);
    const HeroicTest = new RegExp(/Heroic/);
    let result = iterator.next();
    let i = 0
    while (!result.done) {
        let key = result.value;
        let typeOfActivity;
        if (i <= 18) typeOfActivity = 0;
        else if (i > 18 && i <= 40) typeOfActivity = 2;
        else {typeOfActivity = 1}
        const originalKey = key;
        if (MasterTest.test(key) ||PrestigeTest.test(key) || HeroicTest.test(key)) {
            key = key.substring(0, key.toString().lastIndexOf(','));
        }
        const values = activityIdentifiers.get(result.value);
        const saved = d2client.activityIdentifierDB.get(key) as activityIdentifierObject ?? {IDs: [], type: typeOfActivity, difficultName: "", difficultIDs: []};
        if (MasterTest.test(originalKey)) {
            saved.difficultName = "Master";
            values?.forEach(ID => saved.difficultIDs.push(ID));
        }
        if (PrestigeTest.test(originalKey)) {
            saved.difficultName = "Prestige";
            values?.forEach(ID => saved.difficultIDs.push(ID))
        }
        if (HeroicTest.test(originalKey)) {
            saved.difficultName = "Heroic";
            values?.forEach(ID => saved.difficultIDs.push(ID))
        }
        values?.forEach(ID => {
            saved.IDs.push(ID);
        })
        if (!d2client.entityDB.get("activityOrder").includes(key)) {
            const temp = d2client.entityDB.get("activityOrder");
            temp.push(key);
            d2client.entityDB.set("activityOrder", temp);
        }
        d2client.activityIdentifierDB.set(key, saved);
        result = iterator.next();
        i += 1
    }
    console.log("Activity DB done.");
}
