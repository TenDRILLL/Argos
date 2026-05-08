import {
    AutocompleteInteraction,
    ButtonInteraction,
    ChatInputCommandInteraction, CommandInteraction, MessageFlags,
    ModalSubmitInteraction,
    SelectMenuInteraction
} from "discord.js";

export default class DiscordCommand {
    private slashCommand: object;
    private name: string;

    constructor(name: string, slashCommand?: object) {
        this.name = name;
        if(slashCommand){
            this.slashCommand = slashCommand;
        }
    }

    public getName(){
        return this.name;
    }

    public getSlashCommand(){
        return this.slashCommand;
    }

    exec(interaction: ChatInputCommandInteraction|CommandInteraction|ButtonInteraction|SelectMenuInteraction|AutocompleteInteraction|ModalSubmitInteraction){
        console.log(`Please override ${this.name} exec.`);
        switch(true){
            case interaction.isChatInputCommand():
                return this.chatInput(interaction);
            case interaction.isButton():
                return this.button(interaction);
            case interaction.isAnySelectMenu():
                return this.selectMenu(interaction);
            case interaction.isAutocomplete():
                return this.autocomplete(interaction);
            case interaction.isModalSubmit():
                return this.modalSubmit(interaction);
            case interaction.isCommand():
                return this.command(interaction);
            default:
                interaction = interaction as CommandInteraction;
                return interaction.reply({content: "This type of interactions isn't implemented yet.", flags: MessageFlags.Ephemeral});
        }

    }

    chatInput(interaction: ChatInputCommandInteraction){console.log(`Please override ${this.name} chatInput.`);}
    button(interaction: ButtonInteraction){console.log(`Please override ${this.name} button.`);}
    selectMenu(interaction: SelectMenuInteraction){console.log(`Please override ${this.name} selectMenu.`);}
    autocomplete(interaction: AutocompleteInteraction){console.log(`Please override ${this.name} autocomplete.`);}
    modalSubmit(interaction: ModalSubmitInteraction){console.log(`Please override ${this.name} modalSubmit.`);}
    command(interaction: CommandInteraction){console.log(`Please override ${this.name} modalSubmit.`);}
}