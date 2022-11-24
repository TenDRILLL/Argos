import {requestHandler} from "./handlers/requestHandler";
import {getRequest} from "./enums/requests";
import {BungieProfile} from "./props/bungieProfile";

import "dotenv/config";

const client = new requestHandler(process.env.apikey);
client.apiRequest(getRequest("getBungieProfile", {id: "16789084"})).then(apiResponse => {
    const profile = apiResponse.Response as BungieProfile;
    if(profile.steamDisplayName){
        console.log(`Steam: ${profile.steamDisplayName}`);
    }
    if(profile.xboxDisplayName){
        console.log(`Xbox: ${profile.xboxDisplayName}`);
    }
    if(profile.psnDisplayName){
        console.log(`Playstation: ${profile.psnDisplayName}`);
    }
}).catch(e => console.log(e));