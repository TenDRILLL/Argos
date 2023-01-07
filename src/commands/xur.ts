import { getWeaponInfo } from "../handlers/utils";
import { CharacterQuery } from "../props/characterQuery";
import { entityQuery } from "../props/entityQuery";
import {vendorQuery, vendorSaleComponent} from "../props/vendorQuery";
import Command from "./Command";
import {Embed} from "discord-http-interactions";

export default class Xur extends Command {
    constructor(){
        super("xur");
    }

    async cmdRun(interaction, d2client){
        await interaction.defer();
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
                    ).then(d => {
                        const info = d.Response as vendorQuery;
                        const location = info.vendor.data.vendorLocationIndex;
                        this.generateEmbed(info.sales.data, d2client, location).then(embed => {
                            interaction.editReply({
                                embeds: [embed],
                                ephemeral: true
                            }).catch(e => console.log(e));
                        })
                    }).catch(e => {
                        console.log(`Xur isn't anywhere / something went wrong ${e}`)
                        interaction.editReply({
                            content: `Xur doesn't seem to be on any planet, or perhaps something went wrong in searching for him`,
                            ephemeral: true
                        }).catch(e => console.log(e));
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
            return new Embed()
                .setTitle(`Xûr is at ${xurLocations[locationIndex]}`)
                .setColor(0xAE27FF)
                .setDescription("He is currently selling the following exotics")
                .setFields(this.generateFields(data.filter(entity => entity.inventory.tierTypeName === "Exotic" && !["Exotic Engram","Xenology"].includes(entity.displayProperties.name)),3))
        })
    };

    generateFields(exotics,number): {name: string, value: string, inline?: boolean}[] {
        const classTypes = new Map([
            [3, ""],
            [1, "Hunter "],
            [0, "Titan "],
            [2, "Warlock "]
        ])
        let rows: {name: string, value: string, inline?: boolean}[] = [];
        for (let i = 0; i < number; i++) {
            rows.push({"name": "\u200B", "value": "", "inline": true})
        }
        for (let i = 0; i < exotics.length; i++) {
            const exotic = exotics[i];
            rows[i % number]["value"] += `**${exotic.displayProperties.name}**
${i < exotics.length-number ? `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}\n\u200b` : `${classTypes.get(exotic.classType)} ${exotic.itemTypeDisplayName}`}

`
                }
        return rows;
    }
}