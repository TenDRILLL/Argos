import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { setTimeoutAt } from "safe-timers";
import { dbQuery, dbTransaction } from "./Database";
import { userService } from "./UserService";

export interface LFGPost {
    id: string;
    activity: string;
    timeString: string;
    time: number;
    maxSize: string | number;
    creator: string;
    guardians: string[];
    queue: string[];
    desc: string;
}

interface LFGTimers {
    time: number;
    notifytimer: ReturnType<typeof setTimeoutAt>;
    deletetimer: ReturnType<typeof setTimeoutAt>;
}

export class LFGManager {
    private client: Client | null = null;
    private posts: Map<string, LFGPost> = new Map();
    private timers: Map<string, LFGTimers> = new Map();

    init(client: Client): void {
        this.client = client;
        this.createTimers().catch(e => console.error("LFGManager createTimers error:", e));
    }

    getLFG(id: string): LFGPost | null {
        return this.posts.get(id) ?? null;
    }

    saveLFG(post: LFGPost): void {
        this.posts.set(post.id, post);
        this._persistSave(post).catch(e => console.error("LFG save error:", e));
        if (!this.timers.has(post.id)) {
            this._createTimer(post);
        } else {
            const check = this.timers.get(post.id)!;
            if (check.time !== post.time) {
                this.deleteTimer(post.id);
                this._createTimer(post);
            }
        }
    }

    deleteLFG(id: string): void {
        this.posts.delete(id);
        this.deleteTimer(id);
        this._persistDelete(id).catch(e => console.error("LFG delete error:", e));
    }

    deleteTimer(id: string): void {
        if (this.timers.has(id)) {
            const cancel = this.timers.get(id)!;
            cancel.notifytimer.clear();
            cancel.deletetimer.clear();
            this.timers.delete(id);
        }
    }

    editLFG(post: LFGPost, embed: EmbedBuilder): void {
        if (post.guardians.length !== parseInt(post.maxSize as string)) {
            if (post.guardians.length > parseInt(post.maxSize as string)) {
                for (let i = post.guardians.length; i > parseInt(post.maxSize as string); i--) {
                    const removed = post.guardians.pop();
                    if (removed) post.queue.unshift(removed);
                }
            } else {
                for (let i = post.guardians.length; i < parseInt(post.maxSize as string); i++) {
                    const removed = post.queue.shift();
                    if (removed) post.guardians.push(removed);
                }
            }
        }
        this.saveLFG(post);
        this._doEditLFG(post, embed).catch(e => console.error("LFG editLFG error:", e));
    }

    async createTimers(): Promise<void> {
        const rows = await dbQuery("SELECT * FROM lfg");
        for (const row of rows) {
            const members = await dbQuery("SELECT discord_id, queued FROM lfg_members WHERE lfg_id = ?", [row.id]);
            const guardians = members.filter((m: any) => !m.queued).map((m: any) => m.discord_id);
            const queue = members.filter((m: any) => m.queued).map((m: any) => m.discord_id);
            const post: LFGPost = {
                id: row.id,
                activity: row.activity,
                timeString: "",
                time: Number(row.scheduled),
                maxSize: row.max_size,
                creator: row.creator,
                guardians,
                queue,
                desc: row.description ?? ""
            };
            this.posts.set(post.id, post);
            this._createTimer(post);
        }
    }

    private _createTimer(post: LFGPost): void {
        if (!this.client) return;
        const [channelId, messageId] = post.id.split("&");
        this.client.channels.fetch(channelId).then((ch: any) => {
            if (!ch) return Promise.reject(new Error("channel not found"));
            return ch.messages.fetch(messageId);
        }).then(() => {
            if (post.time * 1000 - Date.now() < 0) {
                this.deleteLFG(post.id);
                return;
            }
            const notifytimer = setTimeoutAt(() => {
                this._sendNotification(post).catch(() => this.deleteLFG(post.id));
            }, post.time * 1000 - 1000 * 60 * 10);

            const deletetimer = setTimeoutAt(() => {
                this.deleteLFG(post.id);
            }, post.time * 1000 + 1000 * 60 * 5);

            this.timers.set(post.id, { time: post.time, notifytimer, deletetimer });
        }).catch(() => this.deleteLFG(post.id));
    }

    private async _sendNotification(post: LFGPost): Promise<void> {
        if (!this.client) return;
        const [channelId, messageId] = post.id.split("&");
        const ch: any = await this.client.channels.fetch(channelId);
        if (!ch) { this.deleteLFG(post.id); return; }
        const msg: any = await ch.messages.fetch(messageId).catch(() => null);
        if (!msg) { this.deleteLFG(post.id); return; }
        const postus = this.getLFG(post.id);
        if (!postus) return;
        await msg.edit({
            content: `It's almost time for ${post.activity} fireteam! Get ready:\n${postus.guardians.map((x: string) => `<@${x}>`).join(", ")}`
        }).catch(() => {});
        for (const guardianId of postus.guardians) {
            this.client.users.fetch(guardianId).then((user: any) => {
                user.createDM().then((dmc: any) => {
                    dmc.send({
                        content: `Get ready for ${postus.activity} in <t:${post.time}:R> with\n${postus.guardians.map((x: string) => `<@${x}>`).join("\n")}`
                    }).catch(() => {});
                }).catch(() => {});
            }).catch(() => {});
        }
    }

    private async _persistSave(post: LFGPost): Promise<void> {
        await dbTransaction(async (tx) => {
            await tx(
                "INSERT INTO lfg (id, activity, scheduled, max_size, creator, description) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE scheduled = VALUES(scheduled), max_size = VALUES(max_size), description = VALUES(description)",
                [post.id, post.activity, post.time, post.maxSize, post.creator, post.desc]
            );
            await tx("DELETE FROM lfg_members WHERE lfg_id = ?", [post.id]);
            for (const guardian of post.guardians) {
                await tx("INSERT INTO lfg_members (lfg_id, discord_id, queued) VALUES (?, ?, false)", [post.id, guardian]);
            }
            for (const queued of post.queue) {
                await tx("INSERT INTO lfg_members (lfg_id, discord_id, queued) VALUES (?, ?, true)", [post.id, queued]);
            }
        });
    }

    private async _persistDelete(id: string): Promise<void> {
        await dbQuery("DELETE FROM lfg WHERE id = ?", [id]);
        await dbQuery("DELETE FROM lfg_members WHERE lfg_id = ?", [id]);
        if (!this.client) return;
        const [channelId, messageId] = id.split("&");
        this.client.channels.fetch(channelId).then((ch: any) => {
            if (!ch) return;
            ch.messages.fetch(messageId).then((msg: any) => msg.delete()).catch(() => {});
        }).catch(() => {});
    }

    private async _doEditLFG(post: LFGPost, embed: EmbedBuilder): Promise<void> {
        const guardianNames = await Promise.all(post.guardians.map(id => userService.getDestinyName(id)));
        const queueNames = await Promise.all(post.queue.map(id => userService.getDestinyName(id)));
        embed.setFields([
            { name: "**Activity**", value: post.activity, inline: true },
            { name: "**Start Time:**", value: `<t:${post.time}:F>\n<t:${post.time}:R>`, inline: true },
            { name: "**Description:**", value: post.desc },
            { name: `**Guardians Joined: ${post.guardians.length}/${post.maxSize}**`, value: guardianNames.join(", ") || "None.", inline: true },
            { name: "**Queue:**", value: post.queue.length === 0 ? "None." : queueNames.join(", "), inline: true }
        ]);
        if (!this.client) return;
        const [channelId, messageId] = post.id.split("&");
        this.client.channels.fetch(channelId).then((ch: any) => {
            if (!ch) return;
            ch.messages.fetch(messageId).then((msg: any) => {
                msg.edit({
                    content: "",
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder<ButtonBuilder>().addComponents(
                            new ButtonBuilder()
                                .setLabel(post.guardians.length === parseInt(post.maxSize as string) ? "Join in Queue" : "Join")
                                .setStyle(post.guardians.length === parseInt(post.maxSize as string) ? ButtonStyle.Primary : ButtonStyle.Success)
                                .setCustomId(`lfg-join-${post.id}`),
                            new ButtonBuilder()
                                .setLabel("Leave")
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId(`lfg-leave-${post.id}`),
                            new ButtonBuilder()
                                .setLabel("Edit")
                                .setStyle(ButtonStyle.Secondary)
                                .setCustomId(`lfg-editOptions-${post.id}-${post.creator}`)
                        )
                    ]
                }).catch(() => {});
            }).catch(() => {});
        }).catch(() => {});
    }

}

export const lfgManager = new LFGManager();
