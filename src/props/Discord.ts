export class InteractionResponse {
    type: number;
    data?: RawInteractionMessageResponse | RawInteractionAutocompleteResponse | RawInteractionModalResponse;
}

export class RawInteractionMessageResponse {
    tts?: boolean;
    content?: string;
    embeds?: RawEmbed[];
    allowed_mentions?: RawAllowedMentions;
    flags?: number;
    components?: RawActionRow[];
    attachments?: RawAttachment[];
}

export class RawInteractionAutocompleteResponse {
    choices: RawChoice[];
}

export class RawChoice {
    name: string;
    name_localizations?: RawLocalization[];
    value: string | number;
}

export class RawInteractionModalResponse {
    custom_id: string;
    title: string;
    components: RawActionRow[];
}

export class RawInteraction {
    id: string;
    application_id: string;
    type: number;
    guild_id?: string;
    channel_id?: string;
    member?: RawMember;
    user?: RawUser;
    token: string;
    version: number;
    app_permissions?: string;
    locale?: string;
    guild_locale?: string;
}

export class RawCommandInteraction extends RawInteraction {
    data: {
        id: string;
        name: string;
        type: number;
        resolved?: RawResolvedData;
        options?: RawCommandInteractionOption[];
        guild_id?: string;
        target_id?: string;
    }
}

export class RawButtonInteraction extends RawInteraction {
    message: RawMessage;
    data: {
        custom_id: string;
        component_type: number;
        values?: RawSelectOptionValue[];
    }
}

export class RawResolvedData {
    users?: Map<string,RawUser>;
    members?: Map<string,RawMember>;
    roles?: Map<string,RawRole>;
    channels?: Map<string,RawChannel>;
    messages?: Map<string,RawMessage>;
    attachments?: Map<string,RawAttachment>;
}

export class RawCommandInteractionOption {
    //Command Interaction Option here.
}

export class RawSelectOptionValue {
    //Select Option Value here.
}

export class RawMember {
    user?: RawUser;
    nick?: string;
    avatar?: string;
    roles: string[];
    joined_at: string;
    premium_since?: string;
    deaf: boolean;
    mute: boolean;
    pending?: boolean;
    permissions?: string;
    communication_disabled_until?: string;
}

export class RawUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    bot?: boolean;
    system?: boolean;
    mfa_enabled?: boolean;
    banner?: string | null;
    accent_color?: number | null;
    locale?: string;
    verified?: boolean;
    email?: string | null;
    flags?: number;
    premium_type?: number;
    public_flags?: number;
}

export class RawMessage {
    id: string;
    channel_id: string;
    author: RawUser | RawWebhookUser;
    content: string | null;
    timestamp: string;
    edited_timestamp: string | null;
    tts: boolean;
    mention_everyone: boolean;
    mentions: RawMention[];
    mention_roles: RawRole[];
    mention_channels?: RawChannel[];
    attachments: RawAttachment[] | null;
    embeds: RawEmbed[] | null;
    reactions?: RawReaction[];
    nonce?: number | string;
    pinned: boolean;
    webhook_id?: string;
    type: number;
    activity?: RawMessageActivity;
    application?: RawApplicationObject;
    application_id?: string;
    message_reference?: RawMessageReference;
    flags?: number;
    referenced_message?: RawMessage | null;
    interaction?: {
        id: string;
        type: number;
        name: string;
        user: RawUser;
        member?: RawMember;
    };
    thread?: RawChannel;
    components?: RawActionRow[] | null;
    sticker_items?: RawMessageStickerItem[];
    stickers?: RawSticker[];
    position: number;
}

export class RawActionRow {
    type: 1;
    components: RawComponent[];
}

export class RawComponent {
    custom_id?: string;
    type: number;
}

export class RawButton extends RawComponent {
    style: number;
    label?: string;
    emoji?: {
        id: string;
        name: string;
        animated?: boolean;
    };
    url?: string;
    disabled?: boolean;
}

export class RawMessageActivity {
    //MessageActivity here.
}

export class RawApplicationObject {
    //ApplicationObject here.
}

export class RawMessageReference {
    //MessageReference here.
}

export class RawMessageStickerItem {
    //MessageStickerItem here.
}

export class RawSticker {
    //Sticker here.
}

export class RawAttachment {
    //Attachment here.
}

export class RawReaction {
    //Reaction here.
}

export class RawEmbed {
    //Embed here.
}

export class RawMention {
    //Mention here.
}

export class RawRole {
    //Role here.
}

export class RawWebhookUser {
    //WebhookUser here.
}

export class RawChannel {
    //Channel here.
}

export class RawAllowedMentions {
    //Allowed mentions here.
}

export class RawLocalization {
    //Localization here.
}