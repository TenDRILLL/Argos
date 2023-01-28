import { getWeaponInfo } from "../handlers/utils";
import { CharacterQuery } from "../props/characterQuery";
import {vendorQuery, vendorSaleComponent} from "../props/vendorQuery";
import Command from "./Command";
import {Embed} from "discord-http-interactions";
import { entityQuery } from "../props/entityQuery";

export default class xur extends Command {
    constructor(){
        super("xur");
    }

    async cmdRun(interaction, d2client){
        const embed = d2client.miscDB.get("xurEmbed");
        if (embed) {
            interaction.reply({embeds: [embed]})
        }
        else {
            interaction.reply({content: `Xur doesn't seem to be on any planet`})
        }
    }
}