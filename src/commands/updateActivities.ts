import { updateActivityIdentifierDB } from "../utils/updateActivityIdentifierDB";
import Command from "./Command";


export default class updateActivities extends Command {
    constructor(){
        super("updateactivities");
    }

    cmdRun(interaction, d2client) {
        updateActivityIdentifierDB(d2client)
        interaction.reply({
            content: "Updated"
        })
    }
}