import { APIResponse } from "../props/apiResponse";
import { characterInventoryQuery, CharacterQuery } from "../props/characterQuery";
import { DBUser } from "../props/dbUser";
import { RawManifestQuery } from "../props/manifest";
import { crypt, sortActivities} from "./utils";
import "dotenv/config";

export function getPanelPage(d2client, ID, d, discordUser) {
    return new Promise(async (res,rej)=>{
        const DBData = d as DBUser;
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
        let ans = `<!DOCTYPE html>
        <html lang="en">
    <head>
        <meta content="Venerity panel" property="og:title" />
        <meta content="https://api.venerity.xyz/api/panel" property="og:url" />
        <meta content="https://cdn.discordapp.com/attachments/1045010061799460864/1062832377262526535/crotalogo.jpg" property="og:image" />
        <meta content="#ae27ff" data-react-helmet="true" name="theme-color" />
        <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
        <link rel="stylesheet" href="/resource/panel.css">
        <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
        <title>Venerity</title>
    </head>
    <body>
    <nav>
        <ul>
            <li class="dc">
                <img id="dc-avatar" src="https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png">
                <p>${discordUser.username}#${discordUser.discriminator}</p>
            </li>
            <li>
                <h1 id="heading text">
                    Welcome, ${DBData.destinyName}
                </h1>
            </li>
            <li>
              <button onclick="window.location = '/logout'"><span class="glyphicon glyphicon-log-out" style="margin-right: 3px"></span>Logout</button>
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
        if (DBData.raids["Total"] != 0) {
            ans += `<div class="completionDiv">`;
        ans += `<div class="completionTitle">
                     <h4><b><u>Raid completions</u></b></h4>
                </div>`;
        ans += `<div class="completionTotal">
                     <b>Total: ${DBData.raids["Total"]}</b>
                </div>
                <div class="completionGrid">`
        const raids = sortActivities(DBData.raids);
        Object.keys(raids).forEach(raid=> {
            if (DBData.raids[raid] !== 0 && raid !== "Total") {
                ans += `<div>
                            <b>${raid}</b>
                            <div class="tooltipContainer">${raids[raid].length === 1 ? `${DBData.raids[raid]}` : `${DBData.raids[raid]}*`}
                                ${ raids[raid].length === 1 ? `<div></div>` :
                                    `<div class="tooltiptext">
                                        <p>Normal: ${raids[raid][0] - raids[raid][2]}</p>
                                        <p>${raids[raid][1]}: ${raids[raid][2]}</p>
                                    </div>`
                                }
                            </div>
                        </div>`
            }
        });
        ans += "</div> </div>";
        } if (DBData.dungeons["Total"] != 0) {
            ans += `<div class="completionDiv">`;
            ans += `<div class="completionTitle">
                         <h4><b><u>Dungeon completions</u></b></h4>
                    </div>`;
            ans += `<div class="completionTotal">
                         <b>Total: ${DBData.dungeons["Total"]}</b>
                    </div>
                    <div class="completionGrid">`
        const dungeons = sortActivities(DBData.dungeons);
        Object.keys(dungeons).forEach(dungeon => {
                if (DBData.dungeons[dungeon] !== 0 && dungeon !== "Total") {
                    ans += `<div>
                            <b>${dungeon}</b>
                            <div class="tooltipContainer">${dungeons[dungeon].length === 1 ? `${DBData.dungeons[dungeon]}` : `${DBData.dungeons[dungeon]}*`}
                                ${ dungeons[dungeon].length === 1 ? `<div></div>` :
                                    `<div class="tooltiptext">
                                        <p>Normal: ${dungeons[dungeon][0] - dungeons[dungeon][2]}</p>
                                        <p>${dungeons[dungeon][1]}: ${dungeons[dungeon][2]}</p>
                            </div>`
                        }
                    </div>
                </div>`
                }
            });
            ans += "</div> </div>";
        } if (DBData.grandmasters["Total"] != 0) {
            ans += `<div class="completionDiv">`;
            ans += `<div class="completionTitle">
                        <h4><b><u>Grandmaster completions</u></b></h4>
                    </div>`;
            ans += `<div class="completionTotal">
                        <b>Total: ${DBData.grandmasters["Total"]}</b>
                    </div>
                    <div class="completionGrid">`
        const gms = sortActivities(DBData.grandmasters);
        Object.keys(gms).forEach(gm => {
                if (DBData.grandmasters[gm] !== 0 && gm !== "Total") {
                    ans += `
                            <div>
                                <b>${gm}</b>
                                <div class="tooltipContainer">${DBData.grandmasters[gm]}
                                    <div></div>
                                </div>
                            </div>`
                }
            });
            ans += `
            </div> </div>
            </div>`;
        }
        ans += `</div>
    </body></html>`;
        res(ans);
    });
}

export function choosePlatformhtml(platforms) {
        const icons = ["", "https://cdn.discordapp.com/emojis/1045358581316321280.webp?size=96&quality=lossless",
                            "https://cdn.discordapp.com/emojis/1057027325809672192.webp?size=96&quality=lossless", 
                            "https://cdn.discordapp.com/emojis/1057041438816350349.webp?size=96&quality=lossless",
                            "","",
                            "https://cdn.discordapp.com/emojis/1057027818241916989.webp?size=96&quality=lossless"]
        let endResult = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
            <title>Venerity</title>
            <link rel="stylesheet" href="/resource/choosePlatform.css">
        </head>
        <body>
        <ul><h1>Choose a platform to use</h1><div class="container">`;
        platforms.forEach(x => {
            const acc = crypt(process.env.argosRegisterPassword as string,`${x.membershipType}/seraph/${x.membershipId}`);
            endResult += `<div><a href="/register/${acc}">
                        <img src=${icons[x.membershipType]}>
                        <h2>${x.displayName}</h2>
                        </a></div>`
        });
        endResult += "</div> </ul> </body> </html>";
        return endResult;
}

export function getPreload(url){
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta content="Venerity panel" property="og:title" />
    <meta content="https://api.venerity.xyz/panel" property="og:url" />
    <meta content="https://cdn.discordapp.com/attachments/1045010061799460864/1062832377262526535/crotalogo.jpg" property="og:image" />
    <meta content="#ae27ff" data-react-helmet="true" name="theme-color" />
      <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
      <title>Loading...</title>
      <style>
      * {      box-sizing: border-box;  }   html {      font-size: 24px;  }   body {      margin: 0;       min-height: 100vh;       display: grid;      place-items: center;       background: #030303;  }   .container {      position: relative;      display: flex;      align-items: center;      justify-content: center;       height: 14rem;       width: 14rem;  }   .circle {      position: absolute;      border-radius: 50%;      border: 1px solid #7d7d7d;       z-index: 1;       background-color: transparent;  }   .shape_group {      position: absolute;      display: grid;      place-items: center;      height: 8rem;      width: 8rem;      overflow: hidden;  }   .shape_group .shape {      position: absolute;      border-left: 2.85rem solid transparent;      border-right: 2.85rem solid transparent;       border-bottom: 4.9rem solid #7d7d7d;  }   .line_group {      position: absolute;  }   .line_group .line {      position: absolute;      height: 100%;      width: 1px;       background: linear-gradient(to bottom, transparent 0%, #7d7d7d 20%, #7d7d7d 70%, transparent 100%);  }   .line_group .line.l1 {      left: 0;  }   .line_group .line.l2 {      left: 33%;  }   .line_group .line.l3 {      left: 67%;  }   .line_group .line.l4 {      left: 100%;  }   .default .c1 {      height: 10rem;      width: 10rem;      transition: all 2s ease-in-out;  }   .default .c2 {      height: 9rem;      width: 9rem;      transition: all 2s ease-in-out;  }   .default .c3 {      height: 9rem;      width: 9rem;      transition: all 2s ease-in-out;  }   .default .c4 {      height: 8rem;      width: 8rem;      transition: all 2s ease-in-out;  }   .default .shape_group {      transition: height 2s ease-in-out;  }   .default .shape_group .shape {      transition: transform 2s ease-in-out, border-bottom-color 0.75s ease-in 1.25s;       border-bottom-color: #030303;      transform: rotate(180deg);  }   .default .line_group {      transition: all 2s ease-in-out;  }   .default .line_group .line {      transition: all 2s ease-in-out;  }   .default .line_group.g1 {      height: 15rem;      width: 6rem;  }   .default .line_group.g2 {      height: 15rem;      width: 7.75rem;      transform: rotate(-60deg);  }   .default .line_group.g3 {      height: 15rem;      width: 7.75rem;      transform: rotate(60deg);  }   .warlock .c1 {      height: 6.25rem;      width: 6.25rem;       transition: all 2s ease-in-out;  }   .warlock .c2 {      height: 4rem;      width: 4rem;       transition: all 2s ease-in-out;  }   .warlock .c3 {      height: 12.5rem;      width: 12.5rem;       transition: all 1s ease-in-out 1s;  }   .warlock .c4 {      height: 11.5rem;      width: 11.5rem;       transition: all 1s ease-in-out 1s;  }   .warlock .shape_group .shape {      transition: transform 2s ease-in-out, border-bottom-color 0.75s ease-in 1.25s;  }   .warlock .shape_group .shape.s1, .warlock .shape_group .shape.s4 {      transform: rotate(0) translate(-1.15rem, 0.5rem);  }   .warlock .shape_group .shape.s2, .warlock .shape_group .shape.s5 {      transform: rotate(360deg) translate(0, 0.5rem);  }   .warlock .shape_group .shape.s3, .warlock .shape_group .shape.s6 {      transform: rotate(360deg) translate(1.15rem, 0.5rem);  }   .warlock .line_group {      transition: all 2s ease-in-out;  }   .warlock .line_group .line {      transition: all 2s ease-in-out;       box-shadow: 0 0 0 2px #030303;  }   .warlock .line_group.g1 {      height: 15rem;      width: 6rem;      transform: rotate(-90deg);  }   .warlock .line_group.g1 .l2, .warlock .line_group.g1 .l3 {      opacity: 0;  }   .warlock .line_group.g2 {      height: 15rem;      width: 4rem;      transform: rotate(-150deg);  }   .warlock .line_group.g2 .l1 {      left: 50%;  }   .warlock .line_group.g2 .l2 {      left: 74%;  }   .warlock .line_group.g2 .l3 {      left: 77%;  }   .warlock .line_group.g2 .l4 {      left: 100%;  }   .warlock .line_group.g3 {      height: 15rem;      width: 4rem;      transform: rotate(150deg);  }   .warlock .line_group.g3 .l1 {      left: 0%;  }   .warlock .line_group.g3 .l2 {      left: 24%;  }   .warlock .line_group.g3 .l3 {      left: 27%;  }   .warlock .line_group.g3 .l4 {      left: 50%;  }   .titan .c1 {      height: 10.5rem;      width: 10.5rem;      transition: all 2s ease-in-out;  }   .titan .c2 {      height: 10rem;      width: 10rem;      transition: all 2s ease-in-out;  }   .titan .c3 {      height: 12rem;      width: 12rem;      transition: all 1s ease-in-out 1s;  }   .titan .c4 {      height: 11rem;      width: 11rem;      transition: all 1s ease-in-out 1s;  }   .titan .shape_group .shape {      transition: transform 2s ease-in-out;  }   .titan .shape_group .shape.s1 {      transform: rotate(-90deg) scale(0.535) translate(-3.1rem, -2.5rem);  }   .titan .shape_group .shape.s2 {      transform: rotate(270deg) scale(0.535) translate(3.1rem, -2.5rem);  }   .titan .shape_group .shape.s3 {      transform: rotate(270deg) scale(0.485) translate(0, 3rem);  }   .titan .shape_group .shape.s4 {      transform: rotate(90deg) scale(0.485) translate(0, 3rem);  }   .titan .shape_group .shape.s5 {      transform: rotate(450deg) scale(0.535) translate(-3.1rem, -2.4rem);  }   .titan .shape_group .shape.s6 {      transform: rotate(450deg) scale(0.535) translate(3.1rem, -2.4rem);  }   .titan .line_group {      transition: all 2s ease-in-out;  }   .titan .line_group .line {      transition: all 2s ease-in-out;  }   .titan .line_group.g1 {      height: 15rem;      width: 5.25rem;      transform: rotate(-180deg);  }   .titan .line_group.g1 .l2, .titan .line_group.g1 .l3 {      opacity: 0;  }   .titan .line_group.g2 {      height: 15rem;       width: 5.5rem;      transform: rotate(-240deg);  }   .titan .line_group.g2 .l1 {      left: 0%;  }   .titan .line_group.g2 .l2 {      left: 48%;  }   .titan .line_group.g2 .l3 {      left: 52%;  }   .titan .line_group.g2 .l4 {      left: 100%;  }   .titan .line_group.g3 {      height: 15rem;      width: 5.5rem;      transform: rotate(240deg);  }   .titan .line_group.g3 .l1 {      left: 0%;  }   .titan .line_group.g3 .l2 {      left: 48%;  }   .titan .line_group.g3 .l3 {      left: 52%;  }   .titan .line_group.g3 .l4 {      left: 100%;  }   .hunter .c1 {      height: 5.5rem;      width: 5.5rem;      transition: all 2s ease-in-out;  }   .hunter .c2 {      height: 4rem;      width: 4rem;      transition: all 2s ease-in-out;  }   .hunter .c3 {      height: 9rem;      width: 9rem;      transition: all 2s ease-in-out;  }   .hunter .c4 {      height: 8rem;      width: 8rem;      transition: all 2s ease-in-out;  }   .hunter .shape_group {      transition: height 2s ease-in-out;      height: 6rem;  }   .hunter .shape_group .shape {      transition: all 2s ease-in-out, border-bottom-color 0.75s ease-in 1.25s;  }   .hunter .shape_group .shape.s1 {      transform: rotate(0deg) scale(0.83) translate(0, 1.2rem);  }   .hunter .shape_group .shape.s2 {      transform: rotate(360deg) scale(0.83) translate(0, -3.6rem);  }   .hunter .shape_group .shape.s3 {      transform: rotate(360deg) scale(0.83) translate(0, -1.2rem);  }   .hunter .shape_group .shape.s4 {      border-bottom-color: #030303;      transform: rotate(0deg) scale(0.4) translate(0, 0);  }   .hunter .shape_group .shape.s5 {      border-bottom-color: #030303;      transform: rotate(360deg) scale(0.4) translate(0, -5rem);  }   .hunter .shape_group .shape.s6 {      border-bottom-color: #030303;      transform: rotate(360deg) scale(0.4) translate(0, 5rem);  }   .hunter .line_group {      transition: all 2s ease-in-out;  }   .hunter .line_group .line {      transition: all 2s ease-in-out;  }   .hunter .line_group.g1 {      height: 15rem;      width: 6rem;      transform: rotate(-270deg);  }   .hunter .line_group.g2 {      height: 15rem;      width: 5rem;      transform: rotate(-330deg);  }   .hunter .line_group.g2 .l1 {      left: 0%;  }   .hunter .line_group.g2 .l2 {      left: 20%;  }   .hunter .line_group.g2 .l3 {      left: 40%;      z-index: -1;  }   .hunter .line_group.g2 .l4 {      left: 60%;      z-index: -1;  }   .hunter .line_group.g3 {      height: 15rem;      width: 5rem;      transform: rotate(330deg);  }   .hunter .line_group.g3 .l1 {      left: 40%;  }   .hunter .line_group.g3 .l2 {      left: 60%;  }   .hunter .line_group.g3 .l3 {      left: 80%;  }   .hunter .line_group.g3 .l4 {      left: 100%;  }   .startup .c1 {      height: 10rem;      width: 10rem;      transition: all 0s ease-in-out;  }   .startup .c2 {      height: 9rem;      width: 9rem;      transition: all 0s ease-in-out;  }   .startup .c3 {      height: 9rem;      width: 9rem;      transition: all 0s ease-in-out;  }   .startup .c4 {      height: 8rem;      width: 8rem;      transition: all 0s ease-in-out;  }   .startup .shape_group {      transition: height 0s ease-in-out;  }   .startup .shape_group .shape {      transition: transform 0s ease-in-out, border-bottom-color 0s ease-in 0s;       border-bottom-color: #030303;      transform: rotate(180deg);  }   .startup .line_group {      transition: all 0s ease-in-out;  }   .startup .line_group .line {      transition: all 2s ease-in-out;  }   .startup .line_group.g1 {      height: 15rem;      width: 6rem;  }   .startup .line_group.g2 {      height: 15rem;      width: 7.75rem;      transform: rotate(-60deg);  }   .startup .line_group.g3 {      height: 15rem;      width: 7.75rem;      transform: rotate(60deg);  }  @media only screen and (max-width: 600px) { html { font-size: 16px; } }
      </style>
    </head>
    <body>
      <div class="container">
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
    container.classList.add("startup");
    let classNames = ["startup","warlock", "titan", "hunter","default"];
    let i = 0;
    const timeOut = 100;
    const changeClass = () => {
      container.classList.remove(classNames[i]);
      i = i < classNames.length - 1 ? i + 1 : 0;
      container.classList.add(classNames[i]);
    };
    const initialize = () => {
      container.classList.remove("startup");
      container.classList.add(classNames[i+1]);
    }
    window.location="${url}"
    setTimeout(() => {initialize(); classNames = classNames.splice(1, classNames.length);}, timeOut)
    setInterval(changeClass, 3000);
  }
    </script>
    </body></html>`
}

export function landingPage(){
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Venerity</title>
        <link rel="stylesheet" href="/resource/landing.css">
        <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
    </head>
    <body>
        <h1>Venerity</h1>
        <a class="btn blurple" id="login-link" href="https://discord.com/api/oauth2/authorize?client_id=1045324859586125905&redirect_uri=https%3A%2F%2Fapi.venerity.xyz%2Foauth&response_type=code&scope=identify%20role_connections.write%20connections">Login with Discord</a>
    </body></html>`;
}

export function logout(){
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Venerity</title>
        <link rel="shortcut icon" type="image/webp" href="https://cdn.discordapp.com/emojis/1061526156454666280.webp?size=96&quality=lossless"/>
        <style>
            body {
                background-color: #030303;
            }
        </style>
    </head>
    <body>
        <p>Logged out, redirecting...</p>
        <script>
        setTimeout(()=>{
            window.location = "/";
        },2000);
        </script>
    </body></html>`;
}

export function getErrorPage(errorDetails: string[], button: string) {
    const links = {
        Register: "http://register.venerity.xyz"
    }
    let res = `<!DOCTYPE html>
    <head>
        <title>Error</title>
        <link rel="stylesheet" href="/resource/error.css">
    </head>
    <html>
    <body>
    
    <div class="container">
        <div class="extraShadow1"></div>
        <div class="extraShadow2"></div>
        <div class="borderContainer">
            <div class="border">
                <div class="straight"></div>
                <div class="dot"></div>
                <div class="circleShadow"></div>
            </div>
        </div>
        <div class="ErrorContainer1">
            <div class="ErrorContainer2">
                <div class="ErrorMessage">
                    <h1>ERROR</h1>
                </div>
                <div class="ErrorContents">
                    <div class="ErrorContents2">`
    errorDetails.forEach(e => {
        res += `
<p>${e}</p>`
    })
    res += `
                    </div>
                </div> 
            </div>
        </div>
    </div>`
    res += `
    <div class="buttonContainer">
    <button onclick="window.location.href='${links[button] ?? "/"}';">
        Enter
    </button>
    <h4 onclick="window.location.href='${links[button] ?? "/"}';">
        ${button ?? "Retry"}
    </h4>
    </div>` 

    res += `
    <script>
        addEventListener(document, "keypress", (e)=>{
            e = e || window.event;
            if(e.keyCode === 13){
                console.log("enter!")
                window.location.href = links[button] ?? "/";
            }
        });
    </script>
    </body>
    </html>    `
    return res;
}