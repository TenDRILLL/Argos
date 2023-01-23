import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import {
    getWeaponInfo
} from "./handlers/utils";
import { CharacterQuery } from "./props/characterQuery";
import { entityQuery } from "./props/entityQuery";
import { vendorQuery, vendorSaleComponent } from "./props/vendorQuery";
import {BungieProfile} from "./props/bungieProfile";
import enmap from "enmap";
import {Client, Embed, Emoji} from "discord-http-interactions";
import { RawManifestQuery } from "./props/manifest";
import { activityHistory, PostGameCarnageReport } from "./props/activity";
import { WeaponSlot } from "./enums/weaponSlot";
import axios from "axios";

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

dcclient.login();

function generateFields(exotics: entityQuery[], number: number): Promise<{ name: string; value: string; inline?: boolean; }[]> {
    return new Promise(async (res)=>{
        const manifest = await d2client.apiRequest("getManifests",{});
        let path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyPlugSetDefinition"];
        const socketTypes = await d2client.rawRequest(`https://www.bungie.net${path}`);
        path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyInventoryItemDefinition"];
        const InventoryItemDefinition = await d2client.rawRequest(`https://www.bungie.net${path}`);
        const classTypes = new Map([
            [3, ""],
            [1, "Hunter "],
            [0, "Titan "],
            [2, "Warlock "]
        ]);
        let rows: {name: string, value: string, inline?: boolean}[] = [];
        for (let i = 0; i < number; i++) {
            rows.push({"name": "\u200B", "value": "", "inline": true});
        }
        const exoticPromises: Promise<string>[] = [];
        exotics.forEach((exotic, i) => {
            exoticPromises.push(new Promise(async (res) => {
                let val = `**${exotic.displayProperties.name}**
${i < exotics.length-number ? `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}\n\u200b` : `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}`}
`;
                if(!(WeaponSlot.weapons.includes(exotic.equippingBlock.equipmentSlotTypeHash))){
                    res(val);
                } else {
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
                    let iconNames: string[] = [];
                    for(let i = 0; i < icons.length; i++){
                        const emoji = await dcclient.findEmoji("990974785674674187", icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"));
                        if (emoji === null) {
                            const t: Emoji = await dcclient.createEmoji("990974785674674187", {name: icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"), url: `https://bungie.net${icons[i].icon}`})
                            if(t){
                                iconNames.push(t.toString());
                            }
                        } else {
                            iconNames.push(emoji.toString());
                        }
                    }
                    val += `${iconNames.join(" ")}
`;
                    res(val);
                }
            }));
        });
        Promise.all(exoticPromises).then(data => {
            data.forEach((row,i)=>{
                rows[i % number]["value"] += row;
            });
            console.log(rows);
            res(rows);
        })
    });
}

/*
*********************
*  Metadata Object  *
*********************
*       TYPES       *
*********************
* 1 - int lte       *
* 2 - int gte       *
* 3 - int e         *
* 4 - int ne        *
* 5 - datetime lte  *
* 6 - datetime gte  *
* 7 - bool e        *
* 8 - bool ne       *
*********************
*/

let metadata = [{
    type: 7,
    key: "clanmember",
    name: "Clan Member",
    description: "are a part of the Venerity clan."
}, {
    type: 7,
    key: "visitor",
    name: "Visitor",
    description: "are not a part of the Venerity clan."
}, {
    type: 2,
    key: "raids",
    name: "Raids",
    description: "or more raid clears."
}, {
    type: 2,
    key: "dungeons",
    name: "Dungeons",
    description: "or more dungeon clears."
}, {
    type: 2,
    key: "gms",
    name: "Grandmasters",
    description: "or more grandmaster clears."
}];

//dcclient.rest.put(`/applications/${process.env.discordId}/role-connections/metadata`, {body: metadata}).then(x=>console.log(x)).catch(e=>console.log(e));