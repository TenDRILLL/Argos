export default class DiscordTokens {
    access_token: string;
    expires_in: number;
    expires_at?: number;
    refresh_token: string;
    scope: string;
    token_type: string;
}