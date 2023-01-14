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
import {Client} from "discord-http-interactions";

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