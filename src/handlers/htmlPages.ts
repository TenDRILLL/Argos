import { APIResponse } from "../props/apiResponse";
import { characterInventoryQuery, CharacterQuery } from "../props/characterQuery";
import { DBUser } from "../props/dbUser";
import { RawManifestQuery } from "../props/manifest";
import { crypt } from "./utils";

export function getPanelPage(d2client, ID, d, discordUser) {
    return new Promise(async (res,rej)=>{
        const DBData = d as DBUser;
        const name = await d2client.getBungieName(DBData.bungieId as string);
        const characterResponse = await d2client.apiRequest("getDestinyCharacters", {
            membershipType: DBData.membershipType,
            destinyMembershipId: DBData.destinyId})
        const resp2 = characterResponse.Response as CharacterQuery;
        let promises: Promise<APIResponse>[] = [];
        resp2.characters.filter(character => !character.deleted).forEach(char => {
            promises.push(d2client.apiRequest("getDestinyInventory", {
                membershipType: DBData.membershipType,
                destinyMembershipId: DBData.destinyId,
                characterId: char.characterId}))
        })
        const characters: characterInventoryQuery[] = (await Promise.all(promises)).map(e => e.Response as characterInventoryQuery);
        let ans = `
<head>
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
  <link rel="stylesheet" href="/resource/panel.css">
</head>
<body>
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
              <button><span class="glyphicon glyphicon-log-out"></span> Logout</button>
          </li>
        </ul>
    </nav>
    <div id="content">
        <div id="characters">`
        const recordDefinitionPath = await d2client.apiRequest("getManifests", {}).then(d => { return d.Response["jsonWorldComponentContentPaths"]["en"]["DestinyRecordDefinition"]; });
        const recordDefinitions = await d2client.rawRequest(`https://www.bungie.net${recordDefinitionPath}`) as RawManifestQuery;
        const classHashes = new Map([
            [671679327, "Hunter"],
            [3655393761, "Titan"],
            [2271682572, "Warlock"]
        ]);
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
    </div>`});
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
        ans += `</table>`
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
        res(ans);
    });
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
    return `<!DOCTYPE html>
    <html>
    <head>
      <title>Page loading...</title>
      <link rel="stylesheet" href="/resource/preload.css">
    </head>
    <body>
      <div class="container warlock">
        <div class="circle c1"></div>
        <div class="circle c2"></div>
        <div class="circle c3"></div>
        <div class="circle c4"></div>
        <div class="shape_group">
          <div class="shape s1"></div>
          <div class="shape s2"></div>
          <div class="shape s3"></div>
          <div class="shape s4"></div>
          <div class="shape s5"></div>
          <div class="shape s6"></div>
        </div>
        <div class="line_group g1">
          <div class="line l1"></div>
          <div class="line l2"></div>
          <div class="line l3"></div>
          <div class="line l4"></div>
        </div>
        <div class="line_group g2">
          <div class="line l1"></div>
          <div class="line l2"></div>
          <div class="line l3"></div>
          <div class="line l4"></div>
        </div>
        <div class="line_group g3">
          <div class="line l1"></div>
          <div class="line l2"></div>
          <div class="line l3"></div>
          <div class="line l4"></div>
        </div>
      </div>
      <script>
        window.onload = function() {
        const container = document.querySelector(".container");
        const classNames = ["warlock", "titan", "hunter", "default"];
        let i = 0;
    
        const changeClass = () => {
          container.classList.remove(classNames[i]);
          i = i < classNames.length - 1 ? i + 1 : 0;
          container.classList.add(classNames[i]);
        };
        window.location="${url}"
        changeClass();
        setInterval(changeClass, 3000);
      }
      </script>
    </body></html>`
}

export function unauthenticatedPanel(){
    return `<a href="https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections">Login thx</a>`;
}

export function logout(){
    return `
    <p>Logged out, redirecting...</p>
    <script>
    setTimeout(()=>{
        window.location = "/panel";
    },2000);
    </script>`;
}