import { APIResponse } from "../props/apiResponse";
import { characterInventoryQuery, CharacterQuery } from "../props/characterQuery";
import { DBUser } from "../props/dbUser";
import { RawManifestQuery } from "../props/manifest";
import { crypt } from "./utils";

export async function getPanelPage(d2client, ID, d, discordUser) {
    const DBData = d as DBUser;
    const name = await d2client.getBungieName(DBData.bungieId as string);
    const characterResponse = await d2client.apiRequest("getDestinyCharacters", {
        membershipType: 3,
        destinyMembershipId: DBData.destinyId})
    const resp2 = characterResponse.Response as CharacterQuery;
    let promises: Promise<APIResponse>[] = [];
    resp2.characters.filter(character => !character.deleted).forEach(char => {
        promises.push(d2client.apiRequest("getDestinyInventory", {
            membershipType: 3,
            destinyMembershipId: DBData.destinyId,
            characterId: char.characterId}))
        })
    const characters: characterInventoryQuery[] = (await Promise.all(promises)).map(e => e.Response as characterInventoryQuery);
    let ans = `<body>
    <style>
        body {background-color:#36393f;background-repeat:no-repeat;background-position:top left;background-attachment:fixed; height: 100vh; margin: 0; color: white}
        #heading {display: flex; justify-content: center;}
        #button {line-height: 25px; width: 90px;font-size: 8pt; font-family: tahoma;margin-top: 1px; margin-right: 2px;position:absolute; top:0; right:0; border: None; background-color: #d3d3d3; }
        #characters {display: flex;flex-direction: row;}
        #completions {display: flex;flex-direction: row;margin-left: auto;}
        #content {display: flex;flex-direction: row;}
        .singleCharacter {display: flex;flex-direction: column;font-family: "Open Sans",sans-serif,"Destiny Symbols";margin: 0 15px}
        .characterBanner {background-size: cover;background-repeat: no-repeat;display: flex;flex-direction: row;width: 208px;height: 46px;}
        .raidName {padding-top: 10px 30px 10px 30px; max-height: 40px; }
        .raidAmount { padding: 10px 20px 10px 20px; }
        .className {font-size: 20px; flex: 1;}
        .lightLevel {align-content: flex-end; color: yellow; margin-right: 5px; font-size: 18px ;}
        .nameAndLightContainer { align-items: center; display: flex; flex-flow: row nowrap; margin: 3px}
        .titleName {flex: 1; overflow: hidden; font-size: 12px; font-style: italic; color: yellow; line-height: 10px; margin-left: 3px;}
        .characterStats { display: flex; flex-direction: column;}
        .maxLight {display: flex; flex-direction: row; margin: 5px 0;}
        .maxLight div {display: flex; flex-direction: row;}
        .maxLight img {height: 16px; width: 16px; opacity: 0.6;}
        .statRow {display: flex; flex-direction: row; }
        .statRow div {margin: 0; font-size: 11px; display: flex; flex-direction: row; margin: 0 2px; align-items: center;}
        .statRow img {height: 14px; width: 14px;}
        th {border: solid 1px red; height: 30px; }
        tbody { max-height: 40px; }
        table {display: block;}
        nav { text-align: center; padding: 0; background-color: #000000; margin: 0; overflow: hidden; }
        nav ul {margin: 0; padding: 0; }
        nav ul li {float: left; position: relative; width: 33%; display: inline-block; list-style-type: none; }
        #dc-avatar {vertical-align: middle; display: inline; width: 25px; height: 25px; border-radius: 50%; margin-top: -2px; }
    </style>
    <nav>
        <ul>
            <li>
                <img id="dc-avatar" src="https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png">
                <p>${discordUser.username}#${discordUser.discriminator}</p>
            </li>
            <li>
                <h1 id="heading text"> 
                    Welcome, ${name}
                </h1>
            </li>
            <li>
                <button id="button" onclick="location.href = '/logout'">
                    Logout
                </button>
            </li>
        </ul>
    </nav>
    <div id="test">
            
        </div>
    <div id="content">
        <div id="characters">`
    const recordDefinitionPath = await d2client.apiRequest("getManifests", {}).then(d => { return d.Response["jsonWorldComponentContentPaths"]["en"]["DestinyRecordDefinition"]; });
    const recordDefinitions = await d2client.rawRequest(`https://www.bungie.net${recordDefinitionPath}`) as RawManifestQuery;
    const classHashes = new Map([
        [671679327, "Hunter"],
        [2271682572, "Titan"],
        [3655393761, "Warlock"]
        ])
    characters.sort((a,b) => b.character.data.light-a.character.data.light).forEach(character => {
        ans += `<div class="singleCharacter">
        <div class="characterBanner" style="background-image: url(https://www.bungie.net${character.character.data.emblemBackgroundPath});">
            <div style="height: 32px; width:32px; margin: 0 8px; align-self: center; position: relative;"></div>
            <div style="display: flex; flex-direction: column; flex: 1;">
            <div class="nameAndLightContainer">
                <div class="className">${classHashes.get(character.character.data.classHash)}</div>
                <div class="lightLevel">${character.character.data.light}</div>
            </div>
                <span class="titleName">${recordDefinitions[character.character.data.titleRecordHash] !== undefined ? recordDefinitions[character.character.data.titleRecordHash]["titleInfo"]["titlesByGender"]["Male"] : ""}</span>
        </div>
        </div>
        <div class="characterStats">
            <div class="maxLight">
                <div>
                    <img src="https://www.bungie.net/common/destiny2_content/icons/7c30e0e489e51a3920b4446684fbcdb1.png">
                    <div>${character.character.data.light}</div>
                </div>
            </div>
            <div class="statRow">
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/e26e0e93a9daf4fdd21bf64eb9246340.png">
                        <div>${character.character.data.stats["2996146975"]}</div>
                    </div>
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/202ecc1c6febeb6b97dafc856e863140.png">
                        <div>${character.character.data.stats["392767087"]}</div>
                    </div>
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/128eee4ee7fc127851ab32eac6ca91cf.png">
                        <div>${character.character.data.stats["1943323491"]}</div>
                    </div>
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/ca62128071dc254fe75891211b98b237.png">
                        <div>${character.character.data.stats["1735777505"]}</div>
                    </div>
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/59732534ce7060dba681d1ba84c055a6.png">
                        <div>${character.character.data.stats["144602215"]}</div>
                    </div>
                    <div>
                        <img src="https://www.bungie.net/common/destiny2_content/icons/c7eefc8abbaa586eeab79e962a79d6ad.png">
                        <div>${character.character.data.stats["4244567218"]}</div>
                    </div>
            </div>
        </div>
    </div>`})
    ans += "</div>";
    ans += `<div id="completions">`;
    ans += `<table class="completionTable">
    <thead><tr><th colspan="2">Raid completions</th></tr></thead>`;
    Object.keys(DBData.raids).forEach(raid => {
        if (DBData.raids[raid] !== 0 || raid === "Total") {
        ans += `<tbody><tr>
                <td class="raidName">${raid}</td>
                <td class="raidAmount">${DBData.raids[raid]}</td>
                </tr></tbody>`
        }
    });    
    ans += `</table>`;
    ans += `<table class="completionTable">
    <thead><tr><th colspan="2">Dungeon completions</th></tr></thead>`;
    Object.keys(DBData.dungeons).forEach(dungeon => {
        if (DBData.dungeons[dungeon] !== 0 || dungeon === "Total") {
            ans += `<tbody><tr>
            <td class="raidName">${dungeon}</td>
            <td class="raidAmount">${DBData.dungeons[dungeon]}</td>
            </tr></tbody>`
        }
    });
    ans += `</table;>`
    ans += `<table class="completionTable">
    <thead><tr><th colspan="2">Grandmaster completions</th></tr></thead>`;
    Object.keys(DBData.grandmasters).forEach(gm => {
        if (DBData.grandmasters[gm] !== 0 || gm === "Total") {
            ans += `<tbody><tr>
                <td class="raidName">${gm}</td>
                <td class="raidAmount">${DBData.grandmasters[gm]}</td>
                </tr></tbody>`
        }
    });
    ans += `</table>`;
    ans += `</div>
    </div>
    </body>`;
    return ans
}

export function choosePlatformhtml(platforms) {
        const icons = ["", "https://cdn.discordapp.com/emojis/1045358581316321280.webp?size=96&quality=lossless",
                            "https://cdn.discordapp.com/emojis/1057027325809672192.webp?size=96&quality=lossless", 
                            "https://cdn.discordapp.com/emojis/1057041438816350349.webp?size=96&quality=lossless",
                            "","",
                            "https://cdn.discordapp.com/emojis/1057027818241916989.webp?size=96&quality=lossless"]
        let endResult = `<body>
        <style>body {background-color:#36393f;background-repeat:no-repeat;background-position:top left;background-attachment:fixed;}
        h1 {font-family:Arial, sans-serif; color:white; position: relative;text-align: center; margin: 0;}
        ul {left: 48%;flex-direction: row;align-items: center;position: absolute;top: 40%;transform: translate(-50%, -50%);}
        img {margin-right: 10px; position: relative; clear: right; width: 44px; height: 44px;}
        .container {display: flex; flex-direction: column; border: 0;}
        h2 {display: inline; position: relative; font-family:Arial;}
        a { color: #121212; text-decoration: none; display: flex; align-items: center; padding: 0px 10px 0px 10px; border:1px solid #E2E5DE; border-radius: 15px; background: #E2E5DE;}
        div {display: flex; flex-direction: row; width: 100%; min-height: 60px; justify-content: center; padding: 5px;}</style>
        <ul><h1>Choose a platform to use</h1><div class="container">`;
        platforms.forEach(x => {
            const acc = crypt("malahayati",`${x.membershipType}/seraph/${x.membershipId}`);
            endResult += `<div><a href="/register/${acc}">
                        <img src=${icons[x.membershipType]}>
                        <h2>${x.displayName}</h2>
                        </a></div>`
        });
        endResult += "</div> </ul> </body>";
        return endResult;
}

export function getPreload(url){
    return `<body onLoad="loadPage()">
    <style>
    body
{
margin:0;
padding:0;
background:#262626;
}
.ring
{
position:absolute;
top:50%;
left:50%;
transform:translate(-50%,-50%);
width:150px;
height:150px;
background:transparent;
border:3px solid #3c3c3c;
border-radius:50%;
text-align:center;
line-height:150px;
font-family:sans-serif;
font-size:20px;
color:#fff000;
letter-spacing:4px;
text-transform:uppercase;
text-shadow:0 0 10px #fff000;
box-shadow:0 0 20px rgba(0,0,0,.5);
}
.ring:before
{
content:'';
position:absolute;
top:-3px;
left:-3px;
width:100%;
height:100%;
border:3px solid transparent;
border-top:3px solid #fff000;
border-right:3px solid #fff000;
border-radius:50%;
animation:animateC 2s linear infinite;
}
span
{
display:block;
position:absolute;
top:calc(50% - 2px);
left:50%;
width:50%;
height:4px;
background:transparent;
transform-origin:left;
animation:animate 2s linear infinite;
}
span:before
{
content:'';
position:absolute;
width:16px;
height:16px;
border-radius:50%;
background:#fff000;
top:-6px;
right:-8px;
box-shadow:0 0 20px #fff000;
}
@keyframes animateC
{0%
{transform:rotate(0deg);}
100%
{transform:rotate(360deg);}
}
@keyframes animate
{0%
{transform:rotate(45deg);}
100%
{transform:rotate(405deg);}}
</style>
<div class="ring">Loading
    <span></span>
  </div>
</body>
<script>
    function loadPage() {
        window.location = "${url}";
    }
</script>
`
}

export function unauthenticatedPanel(){
    return `<a href="https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Fapi%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections">Login thx</a>`;
}

export function logout(){
    return `
    <p>Logged out, redirecting...</p>
    <script>
    setTimeout(()=>{
        window.location = "/api/panel";
    },2000);
    </script>`;
}