import { removeAccountRoles } from "../utils/removeAccountRoles";
import Command from "./Command";

export default class Unregister extends Command {
    constructor() {
        super("unregister")
    }
    async cmdRun(interaction, d2client) {
        const authorID = interaction.member ? interaction.member?.user?.id : interaction.user?.id;
        removeAccountRoles(authorID, d2client.lfgmanager.dcclient, d2client) //A bit hacky solution to get access to the dcclient from within a command
        d2client.DB.delete(authorID)
        interaction.reply({content: "Unregistered", ephemeral: true})
    }
}