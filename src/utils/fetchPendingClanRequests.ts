import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from "discord.js";
import { bungieAPI } from "../automata/BungieAPI";
import { dbQuery } from "../automata/Database";
import { userService } from "../automata/UserService";
import { PendingClanmembersQuery } from "../structs/BungieGroupQuery";

export async function fetchPendingClanRequests(client: Client): Promise<void> {
    const adminId = process.env.ADMIN_USER_ID as string;

    const accessToken = await userService.getAdminBungieToken(adminId).catch(e => {
        console.log("fetchPendingClanRequests: admin token refresh failed:", e);
        return null;
    });
    if (!accessToken) return;

    const resp = await bungieAPI.apiRequest("getPendingClanInvites", { groupId: process.env.BUNGIE_CLAN_ID ?? "3506545" }, {
        "Authorization": `Bearer ${accessToken}`
    }).catch(e => { console.log(e); return null; });
    if (!resp) return;

    const clanResp = resp.Response as PendingClanmembersQuery;
    const appEmojis = await client.application!.emojis.fetch();
    const findEmoji = (name: string) => appEmojis.find(e => e.name === name)?.toString() ?? name;
    const emojis: Record<number, string> = {
        1: findEmoji("Xbox"),
        2: findEmoji("PlayStation"),
        3: findEmoji("Steam"),
        6: findEmoji("EpicGames")
    };

    const handledRows = await dbQuery("SELECT value FROM misc WHERE key_name = 'handledApplications'");
    const handled: string[] = handledRows.length ? JSON.parse(handledRows[0].value) : [];

    const channel = client.channels.cache.get(process.env.CLAN_REQUEST_CHANNEL_ID ?? "1048344159326572605") as TextChannel | undefined;
    if (!channel) return;

    for (const req of clanResp.results) {
        if (handled.includes(req.destinyUserInfo.membershipId)) continue;

        const data = await userService.getPartialUserStats({
            destinyId: req.destinyUserInfo.membershipId,
            membershipType: req.destinyUserInfo.membershipType
        }).catch(() => null);

        const embed = new EmbedBuilder()
            .setColor(0xae27ff)
            .setTitle("A new clan request")
            .setFields([
                { name: "User", value: `${req.bungieNetUserInfo.supplementalDisplayName}`, inline: true },
                { name: "Platforms", value: `${req.destinyUserInfo.applicableMembershipTypes.map(y => emojis[y]).join(" ")}`, inline: true },
                { name: "Power Level", value: `${data?.stats?.light ?? "UNKNOWN"}`, inline: true },
                { name: "Raid", value: `${data?.raids?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "Dungeon", value: `${data?.dungeons?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "Grandmaster", value: `${data?.grandmasters?.Total ?? "UNKNOWN"}`, inline: true },
                { name: "PvP K/D", value: `${Math.round((data?.stats?.kd ?? 0) * 100) / 100}` }
            ]);

        const row = new ActionRowBuilder<ButtonBuilder>().setComponents([
            new ButtonBuilder()
                .setLabel("Approve")
                .setStyle(ButtonStyle.Success)
                .setCustomId(`clanrequest-approve-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`),
            new ButtonBuilder()
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger)
                .setCustomId(`clanrequest-deny-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`)
        ]);

        await channel.send({ embeds: [embed], components: [row] }).then(() => {
            handled.push(req.destinyUserInfo.membershipId);
            dbQuery(
                "INSERT INTO misc (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?",
                ["handledApplications", JSON.stringify(handled), JSON.stringify(handled)]
            );
        }).catch(e => console.log(e));
    }
}
