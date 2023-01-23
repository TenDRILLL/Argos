import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import {fetchPendingClanRequests, getWeaponInfo, updateActivityIdentifierDB} from "./handlers/utils";
import { CharacterQuery } from "./props/characterQuery";
import { entityQuery } from "./props/entityQuery";
import { vendorQuery, vendorSaleComponent } from "./props/vendorQuery";
import {BungieProfile} from "./props/bungieProfile";
import enmap from "enmap";
import {Client, Embed, Emoji} from "discord-http-interactions";
import { RawManifestQuery } from "./props/manifest";
import { activityHistory, PostGameCarnageReport } from "./props/activity";
import { WeaponSlot } from "./enums/weaponSlot";

const d2client = new requestHandler();
const dcclient = new Client({
    token: process.env.discordToken as string,
    publicKey: process.env.discordKey as string,
    port: 11542,
    endpoint: "/api/interactions"
});

function instantiateActivityDatabase() {
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
        if (i <= 16) typeOfActivity = 0;
        else if (i > 16 && i <= 38) typeOfActivity = 2;
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

d2client.refreshToken(d2client.adminuserID).then(q => {
    d2client.apiRequest("getDestinyCharacters", {
        membershipType: 3,
        destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
            const resp = t.Response as CharacterQuery;
            // d2client.apiRequest("getActivityHistory", {
            //     membershipType: 3,
            //     destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
            //     characterId: resp.characters.filter(character => !character.deleted)[0].characterId
            // }, {
            //     mode: 4,
            //     page: 1
            // }).then(e => {
            //     const resp = e.Response as activityHistory;
            //     //console.log(resp.activities[0].values)
            //     const id = e.Response["activities"][0]["activityDetails"]["instanceId"]
            //     d2client.apiRequest("getPostGameCarnageReport", {activityId: id}).then(e => { const resp2 = e.Response as PostGameCarnageReport; })
            // })
            // .catch(e => console.log(e))
            d2client.apiRequest("getVendorInformation", {
                membershipType: 3,
                destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
                characterId: resp.characters.filter(character => !character.deleted)[0].characterId,
                vendorHash: "2190858386" /*xur id*/},
                {"Authorization": `Bearer ${q.tokens.accessToken}`}
            ).then(async d => {
                const info = d.Response as vendorQuery;
                const location = info.vendor.data.vendorLocationIndex;
                await generateEmbed(info.sales.data, d2client, location).then(embed => { dcclient.newMessage("1045010061799460864", {embeds: [embed]}   )})
            }).catch(e => {
                console.log(`Xur isn't anywhere / something went wrong ${e}`)
            });
    })
}).catch(() => console.log("Admin user not in DB"));

function generateEmbed(components: vendorSaleComponent[], d2client, locationIndex) {
    const promises: Promise<entityQuery>[] = [];
    Object.keys(components).forEach(key => {
        promises.push(new Promise((res)=>{
            getWeaponInfo(d2client, components[key].itemHash).then(d => {
                res(d);
                })
            })
        )})
    return Promise.all(promises).then(async data => {
        const xurLocations = ["Hangar, The Tower", "Winding Cove, EDZ", "Watcher’s Grave, Nessus"];
        return new Embed()
            .setTitle(`Xûr is at ${xurLocations[locationIndex]}`)
            .setColor(0xAE27FF)
            .setDescription("He is currently selling the following exotics")
            .setFields(await generateFields(data.filter(entity => entity.inventory.tierTypeName === "Exotic" && !["Exotic Engram","Xenology"].includes(entity.displayProperties.name)),3))
    })
};

async function generateFields(exotics: entityQuery[], number: number): Promise<{ name: string; value: string; inline?: boolean; }[]> {
    const manifest = await d2client.apiRequest("getManifests",{})
    let path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyPlugSetDefinition"];
    const socketTypes = await d2client.rawRequest(`https://www.bungie.net${path}`)
    path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyInventoryItemDefinition"];
    const InventoryItemDefinition = await d2client.rawRequest(`https://www.bungie.net${path}`)
    const classTypes = new Map([
        [3, ""],
        [1, "Hunter "],
        [0, "Titan "],
        [2, "Warlock "]
    ])
    let rows: {name: string, value: string, inline?: boolean}[] = [];
    for (let i = 0; i < number; i++) {
        rows.push({"name": "\u200B", "value": "", "inline": true})
    }
    exotics.forEach((exotic, i) => {
        let iconNames;
        if (WeaponSlot.weapons.includes(exotic.equippingBlock.equipmentSlotTypeHash)) {
            const icons: any = []
            exotic.sockets.socketCategories[0].socketIndexes.forEach(e => {
                const plugSetHash = exotic.sockets.socketEntries[e]["reusablePlugSetHash"] ??  exotic.sockets.socketEntries[e]["randomizedPlugSetHash"];
                socketTypes[plugSetHash]["reusablePlugItems"].forEach(e => {
                    icons.push(InventoryItemDefinition[e["plugItemHash"]].displayProperties)
                });
            });
            exotic.sockets.socketCategories[1].socketIndexes.forEach(e => {
                const plugSetHash = exotic.sockets.socketEntries[e]["reusablePlugSetHash"] ??  exotic.sockets.socketEntries[e]["randomizedPlugSetHash"];
                socketTypes[plugSetHash]["reusablePlugItems"].forEach(e => {
                    if (!(InventoryItemDefinition[e["plugItemHash"]].displayProperties.name.includes("Tracker"))) {
                        icons.push(InventoryItemDefinition[e["plugItemHash"]].displayProperties)
                    }
                });
            });
            const promises: Promise<string>[] = [];
            icons.forEach(e => {
                promises.push(new Promise(async (res) => {
                    const emoji = await dcclient.findEmoji("990974785674674187", e.name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"));
                    if (emoji === null) {
                        console.log(e.name.split(" ").join("_"));
                        const t = await dcclient.createEmoji("990974785674674187", {name: e.name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"), url: `https://bungie.net${e.icon}`})
                        res(t.toString())
                    }
                    else {
                        res(emoji.toString())
                    }
                }))
            })
            const iconNames =  await Promise.all(promises)
        }
        rows[i % number]["value"] += `**${exotic.displayProperties.name}**
${i < exotics.length-number ? `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}\n\u200b` : `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}`}
${iconNames === undefined ? "" : iconNames.join(" ")}
`
            })
    return rows;
}