import enmap from "enmap";
import {Embed} from "discord-http-interactions";
import {setTimeoutAt} from "safe-timers";

export default class LFGManager {
    private lfgDB;
    private d2client;
    private dcclient;
    private timers: Map<string,LFGTimers> = new Map();

    constructor(d2client, dcclient) {
        this.lfgDB = new enmap({name: "lfg"});
        this.d2client = d2client;
        this.dcclient = dcclient;
        this.createTimers();
    }

    getLFG(id: string): LFG | undefined {
        console.log(`Getting LFG: ${id}`);
        return this.lfgDB.get(id);
    }

    deleteLFG(id: string){
        console.log(`Deleting LFG: ${id}`);
        this.lfgDB.delete(id);
        this.deleteTimer(id);
        this.dcclient.deleteMessage(id.split("&")[0],id.split("&")[1]).catch(()=>{return true;});
    }

    deleteTimer(id: string){
        console.log(`Deleting timers for: ${id}`);
        if(this.timers.has(id)){
            const cancel = this.timers.get(id);
            clearTimeout(cancel!.notifytimer);
            clearTimeout(cancel!.deletetimer);
            this.timers.delete(id);
        }
    }

    saveLFG(post: LFG){
        console.log(`Saving LFG: ${post.id}`);
        this.lfgDB.set(post.id,post);
        if(!(this.timers.has(post.id))){
            this.createTimer(post);
        } else {
            let check = this.timers.get(post.id);
            if(check!.time !== post.time){
                this.deleteTimer(post.id);
                this.createTimer(post);
            }
        }
    }

    editLFG(post,embed){
        this.saveLFG(post);
        const editedEmbed = new Embed(embed);
        if(!(editedEmbed.fields)) return;
        editedEmbed.fields[0].value = post.activity;
        editedEmbed.fields[1].value = `<t:${post.time}:F>
<t:${post.time}:R>`;
        editedEmbed.fields[2].value = post.desc;
        editedEmbed.fields[3].name = `**Guardians Joined: ${post.guardians.length}/${post.maxSize}**`;
        if(post.guardians.length > post.maxSize){
            //TODO: Take the trailing end of guardians, put first in queue.
        }
        this.dcclient.editMessage(post.id.split("&")[0], post.id.split("&")[1],{
            content: "",
            embeds: [embed]
        }).catch(()=>{return true;});
    }

    createTimers(){
        Array.from(this.lfgDB.keys()).forEach(key => {
            this.createTimer(this.lfgDB.get(key));
        });
    }

    createTimer(post){
        console.log(`createTimer: ${post.id}`);
        this.dcclient.getMessage(post.id.split("&")[0], post.id.split("&")[1]).then(()=>{
            if(parseInt(post.time)*1000 - Date.now() < 0){
                this.deleteLFG(post.id);
            } else {
                const notifytimer = setTimeoutAt(()=>{
                    this.dcclient.getMessage(post.id.split("&")[0], post.id.split("&")[1]).then(()=>{ //If message doesn't exist, we can assume LFG is deleted.
                        let postus = this.lfgDB.get(post.id);
                        this.dcclient.editMessage(post.id.split("&")[0], post.id.split("&")[1],{
                            content: `It's almost time for ${post.activity} fireteam! Get ready:
${postus.guardians.map(x => "<@" + x + ">").join(", ")}`
                        }).catch(()=>{return true;});
                        postus.guardians.forEach(guardianId => {
                            this.dcclient.getDMChannel(guardianId).then(dmc => {
                                this.dcclient.newMessage(dmc["id"],{
                                    content: `Get ready for ${postus.activity} in <t:${post.time}:R> with
${postus.guardians.map(x => "<@" + x + ">").join("\n")}`
                                }).catch(()=>{return true;});
                            }).catch(()=>{return true;}); //These catches exist for if a member doesn't allow DMs, don't want bot to crash due to that.
                        });
                    }).catch(()=>{
                        this.deleteLFG(post.id);
                    });
                }, parseInt(post.time)*1000 - (1000*60*10));
                const deletetimer = setTimeoutAt(()=>{
                    this.deleteLFG(post.id);
                }, parseInt(post.time)*1000 + (1000*60*5));
                this.timers.set(post.id,{
                    time: post.time,
                    notifytimer,
                    deletetimer
                });
            }
        }).catch((()=>this.deleteLFG(post.id)));
    }
}

class LFG {
    id: string;
    activity: string;
    time: string;
    maxSize: string;
    creator: string;
    guardians: string[];
    queue: string[];
}

class LFGTimers {
    time: string;
    notifytimer: ReturnType<typeof setTimeoutAt>;
    deletetimer: ReturnType<typeof setTimeoutAt>;
}