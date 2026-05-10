import DiscordEvent from "../../structs/DiscordEvent";
import DiscordCommand from "../../structs/DiscordCommand";
import {Client, MessageFlags} from "discord.js";

let commands: Map<string, DiscordCommand> = new Map();

export function setCommands(map: Map<string, DiscordCommand>){
    commands = map;
}

export default class InteractionCreateEvent extends DiscordEvent {
    constructor() {
        super("interactionCreate");
    }

    exec(client: Client, ...args) {
        const interaction: any = args[0];
        const key = interaction.customId?.split("-")[0] ?? interaction.commandName;
        const command = commands.get(key);
        if(!command){
            if(interaction.isRepliable())
                interaction.reply({content: "Not implemented yet.", flags: MessageFlags.Ephemeral}).catch((e: any) => console.log(e));
            return;
        }
        command.exec(interaction);
    }
}
