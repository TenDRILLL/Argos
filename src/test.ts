import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import {
    getWeaponInfo, getXurEmbed
} from "./handlers/utils";
import { CharacterQuery } from "./props/characterQuery";
import { entityQuery, socket } from "./props/entityQuery";
import { vendorQuery, vendorSaleComponent } from "./props/vendorQuery";
import {BungieProfile} from "./props/bungieProfile";
import enmap from "enmap";
import {Client, Embed, Emoji} from "discord-http-interactions";
import { RawManifestQuery } from "./props/manifest";
import { activityHistory, PostGameCarnageReport } from "./props/activity";
import { WeaponSlot } from "./enums/weaponSlot";
import axios from "axios";
import { stringify } from "querystring";

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

getXurEmbed(d2client,dcclient).then(e => console.log(e));

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