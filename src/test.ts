import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import {fetchPendingClanRequests, getWeaponInfo, updateActivityIdentifierDB} from "./handlers/utils";
import { CharacterQuery } from "./props/characterQuery";
import { entityQuery } from "./props/entityQuery";
import { vendorQuery, vendorSaleComponent } from "./props/vendorQuery";
import enmap from "enmap";

const d2client = new requestHandler();
const dcclient = new discordHandler();

//fetchPendingClanRequests(dcclient,d2client);
//d2client.localRegister("6fa39615f2bd4a87109269ba207a086d", "190157848246878208");
/*d2client.refreshToken("190157848246878208").then(q => {
    d2client.apiRequest("getDestinyCharacters", {
        membershipType: 3,
        destinyMembershipId: "4611686018468779813"}).then(t => {
            const resp = t.Response as CharacterQuery;
            d2client.apiRequest("getVendor", {
                membershipType: 3,
                destinyMembershipId: "4611686018468779813",
                characterId: resp.characters[0].characterId.toString(),
                vendorHash: "2190858386"},
                {"Authorization": `Bearer ${q.tokens.accessToken}`}
            ).then(d => {
                console.log(d.Response["sales"]["data"]);
        }).catch(e => console.log(e));
    })
});*/

// ["3875551374", "1541131350", "3856705927", "3654674561", "3562696927", "2255796155", "1030017949", "1622998472", "2050789284",
// "3184681056", "541188001", "1097616550", "893527433", "614426548", "2701297915", "4224643669", "3346592680", "2234841490", "1151338093"].forEach(e => {
//     getWeaponInfo(d2client, e).then(q => {
//         if (q.inventory.tierTypeName == 'Exotic' && q.displayProperties.name != "Exotic Engram") {
//             console.log(q.displayProperties.name);
//         }
//     })
// });

function instantiateActivityDatabase() {
    const iterator = activityIdentifiers.keys()
    d2client.activityIdentifierDB.deleteAll();
    d2client.activityIdentifierDB = new enmap({name: "activityIdentifiers"});
    const MasterTest = new RegExp(/Master/);
    const PrestigeTest = new RegExp(/Prestige/)
    let result = iterator.next();
    let i = 0
    while (!result.done) {
        let key = result.value;
        let typeOfActivity;
        if (i <= 16) typeOfActivity = 0;
        else if (i > 16 && i <= 38) typeOfActivity = 2;
        else {typeOfActivity = 1}
        const originalKey = key;
        if (MasterTest.test(key) ||PrestigeTest.test(key)) {
            key = key.substring(0, key.toString().lastIndexOf(','));
        }
        const values = activityIdentifiers.get(result.value); // Fix Prestige overwriting the normal ids
        const saved = d2client.activityIdentifierDB.get(key) as activityIdentifierObject ?? {IDs: [], type: typeOfActivity, difficultName: "", difficultIDs: []};
        if (MasterTest.test(originalKey)) {
            saved.difficultName = "Master";
            values?.forEach(ID => saved.difficultIDs.push(ID));
        }
        if (PrestigeTest.test(originalKey)) {
            saved.difficultName = "Prestige";
            values?.forEach(ID => saved.difficultIDs.push(ID))
        }
        values?.forEach(ID => {
            saved.IDs.push(ID);
        })
        d2client.activityIdentifierDB.set(key, saved);
        result = iterator.next();
        i += 1
    }
    console.log("Activity DB done.");
}


function generateEmbed(components: vendorSaleComponent[], d2client) {
    const weapondata = Promise.all(
        components.map(async e => {
            return await getWeaponInfo(d2client, e.itemHash);
        })
    )
    return [{
        "title": "Xûr is on {planet} at {location}",
        "color": 0xAE27FF,
        "description": "He is currently selling the following exotics",
        "fiels": []
    }]
}

// d2client.refreshToken(d2client.adminuserID).then(q => {
//     d2client.apiRequest("getDestinyCharacters", {
//         membershipType: 3,
//         destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
//             const resp = t.Response as CharacterQuery;
//             d2client.apiRequest("getVendorSales", {
//                 membershipType: 3,
//                 destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
//                 characterId: resp.characters[0].characterId.toString(),
//                 vendorHash: "2190858386" /*xur id*/},
//                 {"Authorization": `Bearer ${q.tokens.accessToken}`}
//             ).then(d => {
//                 const info = d as unknown as vendorQuery;
//                 console.log(info.sales.data);
//                 console.log(generateEmbed(info.sales.data, d2client));
//             }).catch(e => {
//                 console.log(`Xur isn't anywhere / something went wrong ${e}`)
//                 console.log(`Xur doesn't seem to be on any planet.`);
            
//             });
//     }).catch(f => console.log(f))
// }).catch(e => console.log(e)
// )

function getXurLocations() {
    d2client.refreshToken(d2client.adminuserID).then(q => {
        d2client.apiRequest("getDestinyCharacters", {
            membershipType: 3,
            destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
                const resp = t.Response as CharacterQuery;
                d2client.apiRequest("getVendorInformation", {
                    membershipType: 3,
                    destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
                    characterId: resp.characters[0].characterId.toString(),
                    vendorHash: "2190858386" /*xur id*/},
                    {"Authorization": `Bearer ${q.tokens.accessToken}`}
                ).then(d => {
                    console.log(d);
                })
        });
    })
}
//instantiateActivityDatabase()
//updateActivityIdentifierDB(d2client);

//d2client.dbUserUpdater.updateStats("190157848246878208"); // GMs still incorrect

/*
for (let [key, data] of d2client.activityIdentifierDB) {
    const IDs = data["IDs"];
    const type = data["type"];
    const difficultName = data["difficultName"];
    const difficultIDs = data["difficultIDs"];
    console.log(`${key} ${type}`);
    IDs.forEach(d => console.log(`----> ${d}`)) 
}
*/