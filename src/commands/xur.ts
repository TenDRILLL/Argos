import { getWeaponInfo } from "../handlers/utils";
import { CharacterQuery } from "../props/characterQuery";
import { entityQuery } from "../props/entityQuery";
import {vendorQuery, vendorSaleComponent} from "../props/vendorQuery";
import Command from "./Command";

export default class Xur extends Command {
    constructor(){
        super("xur");
    }

    async cmdRun(interaction, d2client){
        d2client.refreshToken(d2client.adminuserID).then(q => {
                d2client.apiRequest("getDestinyCharacters", {
                    membershipType: 3,
                    destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId}).then(t => {
                        const resp = t.Response as CharacterQuery;
                        d2client.apiRequest("getVendorInformation", {
                            membershipType: 3,
                            destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyId,
                            characterId: resp.characters[0].characterId.toString(),
                            vendorHash: "2190858386" /*xur id*/},
                            {"Authorization": `Bearer ${q.tokens.accessToken}`}
                        ).then(d => {
                            const info = d.Response as vendorQuery;
                            const location = info.vendor.data.vendorLocationIndex;
                            interaction.reply({
                                content: "Loading...",
                                flags: 64
                            })
                            this.generateEmbed(info.sales.data, d2client, location).then(embed => {
                                interaction.newMessage({
                                    embeds: embed
                                }).catch(e => console.log(e));
                            })
                        }).catch(e => {
                            console.log(`Xur isn't anywhere / something went wrong ${e}`)
                            interaction.newMessage({
                                content: e.toString(),
                                flags: 64
                            }).catch(e => console.log(e));
                            /*interaction.newMessage({
                                embeds: [
                                    {
                                    "title": `Xur doesn't seem to be on any planet.`,
                                    "color": 0xAE27FF
                                    }
                                ]
                            }).catch(e => console.log(e));
                            */
                        });
                })
        }).catch(() => console.log("Admin user not in DB"));
    }
    private generateEmbed(components: vendorSaleComponent[], d2client, locationIndex) {
        const promises: Promise<entityQuery>[] = [];
        Object.keys(components).forEach(key => {
            promises.push(new Promise((res)=>{
                getWeaponInfo(d2client, components[key].itemHash).then(d => {
                    res(d);
                    })
                })
            )})
        return Promise.all(promises).then(data => {
            const xurLocations = ["Hangar, The Tower", "Winding Cove, EDZ", "Watcher’s Grave, Nessus"];
            const embed = [{
                "title": `Xûr is at ${xurLocations[locationIndex]}`,
                "color": 0xAE27FF,
                "description": "He is currently selling the following exotics",
                "fiels": data.filter(entity => entity.inventory.tierTypeName === "Exotic" && entity.displayProperties.name != "Exotic Engram").map(e => 
                    ({"name": e.displayProperties.name, "value": "\u200B", "inline": true}))
            }]
            return embed;
        })
    };
}