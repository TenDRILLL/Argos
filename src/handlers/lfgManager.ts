import enmap from "enmap";

export default class LFGManager {
    private lfgDB;
    private d2client;
    private dcclient;
    private timers = new Map();

    constructor(d2client, dcclient) {
        this.lfgDB = new enmap({name: "lfg"});
        this.d2client = d2client;
        this.dcclient = dcclient;
        this.createTimers();
    }

    getLFG(id: string): LFG | undefined {
        return this.lfgDB.get(id);
    }

    deleteLFG(id: string){
        this.lfgDB.delete(id);
        if(this.timers.has(id)){
            this.timers.delete(id);
        }
    }

    saveLFG(post: LFG){
        this.lfgDB.set(post.id,post);
        if(!(this.timers.has(post.id))){
            this.createTimer(post);
        }
    }

    editLFG(post){
        this.saveLFG(post);
        this.timers.delete(post.id);
        this.createTimer(post);
    }

    createTimers(){
        Array.from(this.lfgDB.keys()).forEach(key => {
            this.createTimer(this.lfgDB.get(key));
        });
    }

    createTimer(post){
        if(parseInt(post.time)*1000 - Date.now() < 0){
            this.deleteLFG(post.id);
        } else {
            const timer = setTimeout(()=>{
                this.timers.delete(post.id);
                let postus = this.lfgDB.get(post.id);
                postus.guardians.forEach(guardianId => {
                    this.dcclient.getDMChannel(guardianId).then(dmc => {
                        this.dcclient.newMessage(dmc["id"],{
                            content: `Get ready for ${postus.activity} in <t:${post.time}:R> with
${postus.guardians.map(x => "<@" + x + ">").join("\n")}`
                        });
                    });
                });
            }, parseInt(post.time)*1000 - Date.now() - (1000*60*10));
            this.timers.set(post.id,timer);
        }
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
