import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import enmap from "enmap";

const DB = new enmap({name:"users"});
const d2client = new requestHandler(process.env.apikey, DB);
const dcclient = new discordHandler(process.env.discordKey,process.env.discordId,process.env.discordToken);

d2client.apiRequest("getWeaponStats",{membershipType: 3, destinyMembershipId: "4611686018471083678", characterId: "2305843009301540844"}).then(d => {
    console.log(JSON.stringify(d));
}).catch(e => console.log(e));