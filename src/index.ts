import Express from "express";
import { URLSearchParams } from "url";
import bodyParser from "body-parser";
import "dotenv/config";

import {requestHandler} from "./handlers/requestHandler";

const d2client = new requestHandler(process.env.apikey);
const app = Express();
const port = 11542;
const clientID = "37090";

app.use(bodyParser.urlencoded({ extended: false }));
app.use(Express.json());
app.use(bodyParser.json());

app.get("/",(req,res)=>{
    res.sendFile(`${__dirname}/crota.html`);
});

app.get("/authorization", (req, res) => {
    const data = new URLSearchParams();
    data.append("grant_type","authorization_code");
    data.append("code", req.url.split("=")[1]);
    data.append("client_id",clientID);
    d2client.token(data).then(x => {
        res.send(x);
    });
});

app.listen(port, ()=>{
    console.log(`BungoAPIShits http://localhost:${port}/`);
});

/*
https://www.bungie.net/en/OAuth/Authorize?client_id=37090&response_type=code
Code: b90d7797d7c970c3f6b81d7b288d70e5
APIKEY: 336f250b411a44f9a90db0464f3ad2fc
GET: /GroupV2/{GroupId}/Members
Clan ID: 3506545
*/