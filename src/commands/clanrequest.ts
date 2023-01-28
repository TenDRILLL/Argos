import Command from "./Command";
import {BungieProfile} from "../props/bungieProfile";

export default class ClanRequest extends Command {
    constructor(){
        super("clanrequest");
    }

    async btnRun(interaction,d2client){
        const requestData = interaction.data.custom_id.split("-");
        const [action, bungieMembershipId, destinyMembershipId, membershipType] = [requestData[1], requestData[2], requestData[3], requestData[4] ?? "3"];
        d2client.refreshToken(d2client.adminuserID).then(() => {
            const dbUser = d2client.DB.get(d2client.adminuserID);
            d2client.apiRequest("getBungieProfile",{id: bungieMembershipId}).then(d => {
                const resp = d.Response as BungieProfile;
                const data = {
                    membershipType,
                    membershipId: destinyMembershipId,
                    displayName: resp.displayName,
                    bungieGlobalDisplayName: resp.cachedBungieGlobalDisplayName ?? "",
                    bungieGlobalDisplayNameCode: resp.cachedBungieGlobalDisplayNameCode ?? "",
                };
                switch(action){
                    case "approve":
                        d2client.apiRequest(
                            "approveClanMember",
                            {groupId: "3506545"},
                            {"Authorization": `Bearer ${dbUser.tokens.accessToken}`},
                            "post",
                            {
                                memberships: [data],
                                message: "Accepted."
                            }
                        ).then(d2 => {
                            this.deleteData(interaction,d2client,destinyMembershipId,d2);
                        }).catch(e => {
                            interaction.reply({
                                content: e.toString() ?? "Unknown error.",
                                ephemeral: true
                            });
                        });
                        break;
                    case "deny":
                        d2client.apiRequest(
                            "denyClanMember",
                            {groupId: "3506545"},
                            {"Authorization": `Bearer ${dbUser.tokens.accessToken}`},
                            "post",
                            {
                                memberships: [data],
                                message: "Denied."
                            }
                        ).then(d2 => {
                            this.deleteData(interaction,d2client,destinyMembershipId,d2);
                        }).catch(e => {
                            interaction.reply({
                                content: e.toString() ?? "Unknown error.",
                                ephemeral: true
                            });
                        });
                        break;
                    default:
                        interaction.reply({
                            content: `${action} is not a valid action to perform.`,
                            ephemeral: true
                        });
                }
            });
        });
    }

    deleteData(interaction, d2client, id, d){
        const apps = d2client.miscDB.get("handledApplications") ?? [];
        if(apps.includes(id)){
            apps.splice(apps.indexOf(id),1);
            d2client.miscDB.set("handledApplications");
        }
        if(d.Response["ErrorCode"] === 1){
            interaction.reply({
                content: "Accepted.",
                ephemeral: true
            });
        } else {
            interaction.reply({
                content: JSON.stringify(d),
                ephemeral: true
            });
        }
        interaction.delete(interaction.message.id);
    }
}