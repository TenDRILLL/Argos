import type { DBUser } from "../structs/DBUser";
import type DiscordTokens from "../structs/DiscordTokens";

export const fixtureUser: DBUser = {
    discord_id: "123456789012345678",
    bungie_id: "987654321098765432",
    destiny_id: "111222333444555666",
    destiny_name: "Guardian#1234",
    membership_type: 3,
    in_clan: "912643327189475378",
    guardian_rank: 6,
    timezone: "Europe/Helsinki",
    stats_kd: 1.23,
    stats_light: 1810
};

export const fixtureTokens: DiscordTokens = {
    access_token: "acc_token",
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    refresh_token: "ref_token",
    scope: "identify",
    token_type: "Bearer"
};
