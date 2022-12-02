import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import { activityIdentifiers } from "./enums/activityIdentifiers";
import { activityIdentifierObject } from "./props/activityIdentifierObject";
import {fetchPendingClanRequests} from "./handlers/utils";

const d2client = new requestHandler();
const dcclient = new discordHandler();

fetchPendingClanRequests(dcclient,d2client,"");

function instantiateActivityDatabase() {
    const iterator = activityIdentifiers.keys()
    let result = iterator.next();
    while (!result.done) {
        const key = result.value;
        const values = activityIdentifiers.get(result.value.toString());
        const saved = d2client.activityIdentifierDB.get(key) as activityIdentifierObject ?? {IDs: []};
        values?.forEach(e => {
            if (!saved.IDs.includes(e)) {
                saved.IDs.push(e);
            }
        });
        d2client.activityIdentifierDB.set(key, saved);
        result = iterator.next();
    }
    console.log("Activity DB done.");
}

function sleep(seconds){
    return new Promise(res => {
        setTimeout(()=>{
            res("");
        },seconds*1000);
    });
}

//instantiateActivityDatabase();