import DiscordCommand from "../../structs/DiscordCommand";
import { ButtonInteraction, MessageFlags } from "discord.js";
import { dbQuery } from "../../automata/Database";
import { bungieAPI } from "../../automata/BungieAPI";
import { userService } from "../../automata/UserService";
import { BungieProfile } from "../../structs/BungieProfile";

export default class ClanRequest extends DiscordCommand {
    constructor() {
        super("clanrequest");
    }

    async button(interaction: ButtonInteraction) {
        const parts = interaction.customId.split("-");
        const [action, bungieMembershipId, destinyMembershipId, membershipType] = [parts[1], parts[2], parts[3], parts[4] ?? "3"];
        const adminId = process.env.ADMIN_USER_ID as string;

        const accessToken = await userService.getAdminBungieToken(adminId).catch(e => {
            interaction.reply({ content: `Token refresh failed: ${e}`, flags: MessageFlags.Ephemeral });
            return null;
        });
        if (!accessToken) return;

        const profileData = await bungieAPI.apiRequest("getBungieProfile", { id: bungieMembershipId });
        const resp = profileData.Response as BungieProfile;
        const memberData = {
            membershipType,
            membershipId: destinyMembershipId,
            displayName: resp.displayName,
            bungieGlobalDisplayName: resp.cachedBungieGlobalDisplayName ?? "",
            bungieGlobalDisplayNameCode: resp.cachedBungieGlobalDisplayNameCode ?? ""
        };

        const endpoint = action === "approve" ? "approveClanMember" : action === "deny" ? "denyClanMember" : null;
        if (!endpoint) {
            return interaction.reply({ content: `${action} is not a valid action.`, flags: MessageFlags.Ephemeral });
        }
        const message = action === "approve" ? "Accepted." : "Denied.";
        const actionLabel = action === "approve" ? "approved" : "rejected";

        const result = await bungieAPI.apiRequest(
            endpoint,
            { groupId: process.env.BUNGIE_CLAN_ID ?? "3506545" },
            { Authorization: `Bearer ${accessToken}` },
            "post",
            { memberships: [memberData], message }
        ).catch(e => {
            if (e["Response"] !== undefined) return e;
            interaction.reply({ content: e.toString() ?? "Unknown error.", flags: MessageFlags.Ephemeral });
            return null;
        });
        if (!result) return;

        await this.deleteData(interaction, destinyMembershipId, result, actionLabel);
    }

    private async deleteData(interaction: ButtonInteraction, id: string, d: any, action: string) {
        const miscRows = await dbQuery("SELECT value FROM misc WHERE key_name = 'handledApplications'");
        const apps: string[] = miscRows.length > 0 ? JSON.parse(miscRows[0].value) : [];

        if (d["ErrorCode"] === 1) {
            await interaction.reply({ content: `Application ${action}.`, flags: MessageFlags.Ephemeral });
            if (apps.includes(id)) {
                apps.splice(apps.indexOf(id), 1);
                await dbQuery(
                    "INSERT INTO misc (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=?",
                    ["handledApplications", JSON.stringify(apps), JSON.stringify(apps)]
                );
            }
            interaction.message.delete().catch(e => console.log(e));
        } else {
            interaction.reply({ content: JSON.stringify(d), flags: MessageFlags.Ephemeral });
        }
    }
}
