import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {activityIdentifiers, directActivityModeType} from "./enums/activityIdentifiers";
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
import {getRequest} from "./enums/requests";

const dcclient = new Client({
    token: process.env.discordToken as string,
    publicKey: process.env.discordKey as string,
    port: 11542,
    endpoint: "/api/interactions"
});
const d2client = new requestHandler(dcclient);

dcclient.on("ready",()=>{
    console.log("READY");
    d2client.refreshToken("497356994890432522").then(dbuser => {
        d2client.apiRequest("getDestinyCharacters",{membershipType: dbuser.membershipType, destinyMembershipId: dbuser.destinyId}).then(d => {
            const asdf = [];
            //@ts-ignore
            d.Response.characters.map(x => x.characterId).forEach(characterid => {
                //@ts-ignore
                asdf.push(run(dbuser, characterid,0,0,[]));
            });
            Promise.all(asdf).then(d => {
                //@ts-ignore
                console.log(d.map(x => x.total).reduce((a,b) => a + b));
                d.forEach(x => {
                    let count = {};
                    //@ts-ignore
                    x.types.forEach(y => {
                        // @ts-ignore
                        let name = [...directActivityModeType].find(([k,v]) => v == y);
                        //@ts-ignore
                        name = name === undefined ? "undefined" : name[0];
                        //@ts-ignore
                        if(count[name] === undefined){
                            //@ts-ignore
                            count[name] = 0;
                        }
                        //@ts-ignore
                        count[name]++;
                    });
                    console.log(count);
                });
                console.log(d);
            });
        });
    })
});
function run(dbuser, characterid, page, total, types){
    return new Promise(res =>{
        getAct(dbuser, characterid, page).then((data)=>{
            //@ts-ignore
            total += data.len;
            //@ts-ignore
            types.push(...data.types);
            console.log(page);
            //@ts-ignore
            if(data.len !== 250){
                res({characterid, total, types});
            } else {
                page += 1;
                res(run(dbuser, characterid, page, total, types));
            }
        });
    });
}

function getAct(dbuser, characterid, page){
    return new Promise((res,rej)=>{
        d2client.apiRequest("getActivityHistory",{
            membershipType: dbuser.membershipType,
            destinyMembershipId: dbuser.destinyId,
            characterId: characterid,
            query: `count=250&mode=0&page=${page}`
        }, {"Authorization": `Bearer ${dbuser.tokens.accessToken}`}).then(d => {
            //@ts-ignore
            res({len: d.Response.activities?.length ?? 0, types: d.Response.activities.map(x => x.activityDetails.mode)});
        }).catch(e => console.log(e));
    });
}

dcclient.login();

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