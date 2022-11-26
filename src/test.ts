import "dotenv/config";
import {requestHandler} from "./handlers/requestHandler";
import {discordHandler} from "./handlers/discordHandler";
import enmap from "enmap";
import {WeaponQuery} from "./props/weaponQuery";

const DB = new enmap({name:"users"});
const d2client = new requestHandler(process.env.apikey, DB);
const dcclient = new discordHandler(process.env.discordKey,process.env.discordId,process.env.discordToken);

d2client.apiRequest("getWeaponStats",{membershipType: 3, destinyMembershipId: "4611686018471083678", characterId: "2305843009301540844"}).then(d => {
    const resp = d.Response as WeaponQuery;
    resp.weapons.sort((a,b) => {
        return a.values.uniqueWeaponKills.basic.value > b.values.uniqueWeaponKills.basic.value ? -1 : 1;
    });
    console.log(resp.weapons[0]);
}).catch(e => console.log(e));