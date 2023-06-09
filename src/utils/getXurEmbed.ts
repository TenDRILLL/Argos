import { Embed, Emoji } from "discord-http-interactions";
import { socketComponents, vendorQuery } from "../props/vendorQuery";
import { CharacterQuery } from "../props/characterQuery";
import { entityQuery } from "../props/entityQuery";
import { WeaponSlot } from "../enums/weaponSlot";
import { RawEntityQuery } from "../props/manifest";

export const XUR_CHANNEL_ID = '980143760149188648'

export function getXurEmbed(d2client, dcclient): Promise<Embed> {
    const statHashes = ['2996146975', '392767087', '1943323491', '1735777505', '144602215', '4244567218']
    return new Promise((res, rej) => {
        d2client.refreshToken(d2client.adminuserID).then(q => {
            d2client.apiRequest("getDestinyCharacters", {
                membershipType: 3,
                destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
                    const resp = t.Response as CharacterQuery;
                    d2client.apiRequest("getVendorInformation", {
                        membershipType: 3,
                        destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
                        characterId: resp.characters.filter(character => !character.deleted)[0].characterId,
                        vendorHash: "2190858386" /*xur id*/},
                        {"Authorization": `Bearer ${q.tokens.accessToken}`}
                    ).then(async d => {
                        const info = d.Response as vendorQuery;
                        const location = info.vendor.data.vendorLocationIndex;
                        const data = info.categories.data.categories[0].itemIndexes.concat(info.categories.data.categories[1].itemIndexes).filter(e => e != 0).map(index => {
                            return {
                                itemHash: info.sales.data[index].itemHash,
                                sockets: info.itemComponents.sockets.data[index].sockets,
                                stats: statHashes.map(e => info.itemComponents.stats.data[index].stats[e]?.value)
                            };                  
                        })
                        await generateEmbed(data , d2client, location).then(embed => { res(embed) })
                    }).catch(e => {
                        console.log(`Xur isn't anywhere / something went wrong ${e}`)
                        rej("Xur isn't on any planet.")
                    });
            }).catch(e => rej(e))
    }).catch(() => console.log("Admin user not in DB"));
})
    
    function generateEmbed(components: {itemHash: number, sockets: socketComponents[], stats: number[]}[], d2client, locationIndex) {
        const promises: Promise<entityQuery>[] = [];
        components.forEach(item => {
            promises.push(new Promise((res)=>{
                getWeaponInfo(d2client, item.itemHash).then(d => {
                    res(d);
                    })
                })
            )})
        return Promise.all(promises).then(async data => {
            const xurLocations = ["Hangar, The Tower", "Winding Cove, EDZ", "Watcher’s Grave, Nessus"];
            return new Embed()
                .setTitle(`Xûr is at ${xurLocations[locationIndex]}`)
                .setColor(0xAE27FF)
                .setDescription("He is currently selling the following exotics")
                .setFields(await generateFields(data,components,3, dcclient))
        })
    }
    
    function generateFields(exotics: entityQuery[], components: {itemHash: number, sockets: socketComponents[], stats: number[] }[] , number: number, dcclient): Promise<{ name: string; value: string; inline?: boolean; }[]> {
        return new Promise(async (res)=>{
            const manifest = await d2client.apiRequest("getManifests",{});
            const path = manifest.Response["jsonWorldComponentContentPaths"]["en"]["DestinyInventoryItemDefinition"];
            const InventoryItemDefinition = await d2client.rawRequest(`https://www.bungie.net${path}`) as RawEntityQuery;
            const classTypes: Map<number, string> = new Map([
                [3, ""],
                [1, "<:hunter2:1067375164012101642>"],
                [0, "<:titan2:1067375189421203486>"],
                [2, "<:warlock2:1067375209985880074>"]
            ]);
            const statEmojies = [
                "<:mobility:1068928862538440784>",
                "<:resilience:1068928804170514594>",
                "<:recovery:1068928541183455292>",
                "<:discipline:1068928610699841716>",
                "<:intellect:1068928723908313131>",
                "<:strength:1068928763884228728>"
            ]
            let rows: {name: string, value: string, inline?: boolean}[] = [];
            const exoticPromises: Promise<{name: string, value: string, inline?: boolean}>[] = [];
            exotics.forEach((exotic, i) => {
                const component = components.filter(e => e.itemHash === exotic.hash)[0];
                exoticPromises.push(new Promise(async (res) => {
                    const icons: any = []
                    let val = {"name": exotic.displayProperties.name, "value": `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}` , "inline": true}
                    icons.push(exotic.displayProperties)
                    if((WeaponSlot.weapons.includes(exotic.equippingBlock.equipmentSlotTypeHash))){
                        exotic.sockets.socketCategories[0].socketIndexes.forEach(e => {
                            const perkHash = component.sockets[e].plugHash
                            const perk = InventoryItemDefinition[perkHash]
                            if (!(perk.displayProperties.name.includes("Tracker"))) {
                                icons.push(perk.displayProperties)
                            }
                        });
                        exotic.sockets.socketCategories[1].socketIndexes.forEach(e => {
                            const perkHash = component.sockets[e].plugHash
                            const perk = InventoryItemDefinition[perkHash]
                            if (!(perk.displayProperties.name.includes("Tracker"))) {
                                icons.push(perk.displayProperties)
                            }
                        });
                    }
                    else {
                        val.value += "\n";
                        component.stats.forEach((e, i) => {
                            val.value += `${statEmojies[i]} ${e.toString().padEnd(3," ")}`;
                            if (i == 2) val.value += "\n";
                        })
                        val.value += `
Total: ${component.stats.reduce((a, b) => a+b)}`
                    }    
                    let iconNames: string[] = [];
                    for(let i = 0; i < icons.length; i++){
                        const emoji = await dcclient.findEmoji("990974785674674187", icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"));
                        if (emoji === null) {
                            const t: Emoji = await dcclient.createEmoji("990974785674674187", {name: icons[i].name.replaceAll(/[^0-9A-z ]/g, "").split(" ").join("_"), url: `https://bungie.net${icons[i].icon}`})
                            if(t){
                                iconNames.push(t.toString());
                            }
                        } else {
                            iconNames.push(emoji.toString());
                        }
                    }
                    val.name = `${iconNames[0].toString()} ${val.name}`
                    iconNames.shift();
                    val.value += `
    ${iconNames.join(" ")}`;
                    res(val);
                }));
            });
            Promise.all(exoticPromises).then(data => {
                data.forEach((row,i)=>{
                    rows.push(row);
                });
                rows.sort((a,b) => a.value.length - b.value.length)
                rows = rows.map((e,i) => { if (i < 3) {e.value += "\n\u200b";} return e; })
                res(rows);
            })
        });
    }
}

function getWeaponInfo(d2client,weaponID): Promise<entityQuery> {
    return new Promise<entityQuery>(res => {
        d2client.apiRequest("getEntity", {hashIdentifier: weaponID}).then(u => {
            const item = u.Response as entityQuery;
            res(item);
        }).catch(e => console.log(e));
    });
}