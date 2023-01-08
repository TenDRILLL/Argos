import {requestHandler} from "../handlers/requestHandler";
import {InteractionType} from "discord-http-interactions";

export default abstract class Command {
    private readonly name: string;

    constructor(name: string){
        this.name = name;
    }

    getName(): string { return this.name; }

    run(interaction, d2client: requestHandler){
        if(interaction.type === InteractionType.ApplicationCommand){
            this.cmdRun(interaction, d2client);
        } else if(interaction.type === InteractionType.MessageComponent){
            this.btnRun(interaction, d2client);
        } else if(interaction.type === InteractionType.ApplicationCommandAutocomplete){
            this.acRun(interaction, d2client);
        }
    }

    cmdRun(interaction, d2client){
        console.log(`${this.name} cmdRun ran, but wasn't overridden.`);
    }

    btnRun(interaction, d2client){
        console.log(`${this.name} btnRun ran, but wasn't overridden.`);
    }

    acRun(interaction, d2client){
        console.log(`${this.name} acRun ran, but wasn't overridden.`);
    }
}