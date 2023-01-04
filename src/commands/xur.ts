import { getWeaponInfo } from "../handlers/utils";
import { CharacterQuery } from "../props/characterQuery";
import {vendorQuery, vendorSaleComponent} from "../props/vendorQuery";
import Command from "./Command";

export default class xur extends Command {
    constructor(){
        super("xur");
    }

    async cmdRun(interaction, d2client){
        d2client.refreshToken(d2client.adminuserID).then(q => {
                d2client.apiRequest("getDestinyCharacters", {
                    membershipType: 3,
                    destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyMembershipId}).then(t => {
                        const resp = t.Response as CharacterQuery;
                        d2client.apiRequest("getVendor", {
                            membershipType: 3,
                            destinyMembershipId: d2client.DB.get(d2client.adminuserID).destinyMembershipId,
                            characterId: resp.characters[0].characterId.toString(),
                            vendorHash: "2190858386" /*xur id*/},
                            {"Authorization": `Bearer ${q.tokens.accessToken}`}
                        ).then(d => {
                            const info = d as vendorQuery;
                            console.log(info.sales.data);
                            interaction.reply({
                                embeds: this.generateEmbed(info.sales.data, d2client)
                            });
                        }).catch(e => {
                            console.log(`Xur isn't anywhere / something went wrong ${e}`)
                            interaction.reply({
                                    embeds: [
                                        {
                                        "title": `Xur doesn't seem to be on any planet.`,
                                        "color": 0xAE27FF
                                        }
                                    ]
                                });
                        });
                })
        }).catch(() => console.log("Admin user not in DB"));
    }
    private generateEmbed(components: vendorSaleComponent[], d2client) {
        const weapondata = Promise.all(
            components.map(async e => {
                return await getWeaponInfo(d2client, e.itemHash);
            })
        )
        return [{
            "title": "Xûr is on {planet} at {location}",
            "color": 0xAE27FF,
            "description": "He is currently selling the following exotics",
            "fiels": []
        }]
    }
}