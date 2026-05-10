import DiscordCommand from "../../structs/DiscordCommand";
import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { bungieAPI } from "../../automata/BungieAPI";
import { buildFromManifest } from "../../enums/activityIdentifiers";

export default class UpdateActivities extends DiscordCommand {
    constructor() {
        super("updateactivities", { name: "updateactivities", description: "Update the activity identifier database from the Bungie manifest." });
    }

    async chatInput(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
            const manifest = await bungieAPI.apiRequest("getManifests", {});
            const actPath: string | undefined = (manifest.Response as any)?.jsonWorldComponentContentPaths?.en?.DestinyActivityDefinition;
            if (!actPath) throw new Error("Manifest missing DestinyActivityDefinition path");
            const defs = await bungieAPI.rawRequest(`https://www.bungie.net${actPath}`) as Record<string, any>;
            const { raids, dungeons, gms, newEntries } = buildFromManifest(defs);

            const typeLabel = ["Raid", "Dungeon", "GM"];
            const newLines = newEntries.map(e => {
                const ids    = `[${e.IDs.join(",")}]`;
                const diff   = e.difficultIDs.length ? `, difficultName:"${e.difficultName}", difficultIDs:[${e.difficultIDs.join(",")}]` : "";
                return `• **${e.name}** (${typeLabel[e.type]}) — IDs: \`${ids}\`${diff}`;
            });

            const summary = `Activity DB updated. Raids: **${raids}** | Dungeons: **${dungeons}** | GMs: **${gms}**`;
            const newSection = newEntries.length
                ? `\n\n**${newEntries.length} new (add to rawIdentifiers):**\n${newLines.join("\n")}`
                : "\n\nNo new activities found.";

            const full = summary + newSection;
            // Discord message cap: 2000 chars; truncate with notice if over
            await interaction.editReply({ content: full.length <= 2000 ? full : full.slice(0, 1980) + "\n…(truncated)" });
        } catch (e) {
            console.error("[UpdateActivities] manifest refresh failed:", e);
            await interaction.editReply({ content: `Update failed: ${e}` });
        }
    }
}
