import {Interaction} from "../handlers/discordHandler";
import {requestHandler} from "../handlers/requestHandler";

export default abstract class Command {
    private readonly name: string;

    constructor(name: string){
        this.name = name;
    }

    getName(): string { return this.name; }

    run(interaction: Interaction, d2client: requestHandler){
        if(interaction.type === 2){
            this.cmdRun(interaction, d2client);
        } else if(interaction.type === 3){
            this.btnRun(interaction, d2client);
        } else if(interaction.type === 4){
            this.acRun(interaction);
        }
    }

    cmdRun(interaction, d2client){
        console.log(`${this.name} cmdRun ran, but wasn't overridden.`);
    }

    btnRun(interaction, d2client){
        console.log(`${this.name} btnRun ran, but wasn't overridden.`);
    }

    acRun(interaction){
        console.log(`${this.name} acRun ran, but wasn't overridden.`);
    }
}