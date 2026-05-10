import DiscordCommand from "../../structs/DiscordCommand";
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import axios from "axios";
import { dbQuery } from "../../automata/Database";
import { getToken } from "../../automata/DiscordTokenManager";
import { statRoles } from "../../enums/statRoles";

export default class Unregister extends DiscordCommand {
    constructor() {
        super("unregister", { name: "unregister", description: "Unregister your account from Argos." });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.client.guilds.cache.get(statRoles.guildID);
        if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                const newRoles = Array.from(member.roles.cache.keys())
                    .filter(x => !statRoles.allIDs.includes(x))
                    .sort();
                await member.roles.set(newRoles).catch(e => console.log(e));
            }
        }

        const token = await getToken(userId).catch(() => null);
        if (token) {
            axios.put(
                `https://discord.com/api/v10/users/@me/applications/${process.env.DISCORD_ID}/role-connection`,
                {},
                { headers: { Authorization: token, "Content-Type": "application/json" } }
            ).catch(e => console.log(e));
        }

        await dbQuery("DELETE FROM user_activities WHERE discord_id = ?", [userId]);
        await dbQuery("DELETE FROM user_tokens WHERE discord_id = ?", [userId]);
        await dbQuery("DELETE FROM discordToken WHERE id = ?", [userId]);
        await dbQuery("DELETE FROM users WHERE discord_id = ?", [userId]);

        await interaction.editReply({ content: "Unregistered." });
    }
}
