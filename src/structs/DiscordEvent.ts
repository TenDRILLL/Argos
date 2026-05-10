import {Client} from "discord.js";

export default class DiscordEvent {
    private event: string;
    private once: boolean;

    constructor(event: string, once: boolean = false) {
        this.event = event;
        this.once = once;
    }

    public getEventName(){
        return this.event;
    }

    public isOnce(){
        return this.once;
    }

    exec(client: Client, ...args){console.log(`Please override ${this.event} exec.`)}
}