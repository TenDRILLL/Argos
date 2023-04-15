import { ActionRow, Button, ButtonStyle, Embed, Emoji } from "discord-http-interactions";
import { PendingClanmembersQuery } from "../props/bungieGroupQuery";

export function fetchPendingClanRequests(dcclient, d2client) {
    d2client.refreshToken(d2client.adminuserID).then(d => {
        d2client.apiRequest("getPendingClanInvites",{groupId: "3506545"}, {"Authorization": `Bearer ${d.tokens.accessToken}`}).then(d => {
            const resp = d.Response as PendingClanmembersQuery;
            const emojis = {1: "<:Xbox:1045358581316321280>", 2: "<:PlayStation:1057027325809672192>", 3: "<:Steam:1045354053087006800>", 6: "<:EpicGames:1048534129500770365>"};
            const handled = d2client.miscDB.get("handledApplications") ?? [];
            resp.results.forEach(async req => {
                if (!handled.includes(req.destinyUserInfo.membershipId)) {
                    const data = await d2client.dbUserUpdater.getPartialUserStats(
                        {
                            destinyId: req.destinyUserInfo.membershipId,
                            membershipType: req.destinyUserInfo.membershipType,
                        }
                        );
                    const embed = new Embed()
                        .setColor(0xae27ff)
                        .setTitle("A new clan request")
                        .setFields([
                            {"name": "User", "value": `${req.bungieNetUserInfo.supplementalDisplayName}`, "inline": true},
                            {"name": "Platforms", "value": `${req.destinyUserInfo.applicableMembershipTypes.map(y => emojis[y]).join(" ")}`, "inline": true},
                            {"name": "Power Level", "value": `${data.stats?.light ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Raid", "value": `${data.raids?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Dungeon", "value": `${data.dungeons?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "Grandmaster", "value": `${data.grandmasters?.Total ?? "UNKNOWN"}`, "inline": true},
                            {"name": "PvP K/D", "value": `${Math.round((data.stats?.kd ?? 0) * 100)/100}`}
                        ])
                    const actionRows: ActionRow[] = [];
                    actionRows.push(
                        new ActionRow().setComponents([
                            new Button()
                                .setLabel("Approve")
                                .setStyle(ButtonStyle.Success)
                                .setCustomId(`clanrequest-approve-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`),
                            new Button()
                                .setLabel("Deny")
                                .setStyle(ButtonStyle.Danger)
                                .setCustomId(`clanrequest-deny-${req.bungieNetUserInfo.membershipId}-${req.destinyUserInfo.membershipId}-${req.destinyUserInfo.membershipType}`)
                        ])
                    );
                    dcclient.newMessage("1048344159326572605",{
                        embeds: [embed],
                        components: actionRows
                    }).then(() => {
                        handled.push(req.destinyUserInfo.membershipId);
                        d2client.miscDB.set("handledApplications", handled);
                    });
                }
            })
        }).catch(e => console.log(e));
    });
}