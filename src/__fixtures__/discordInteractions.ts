import { mock } from "bun:test";

export function makeChatInput(overrides: Record<string, any> = {}): any {
    return {
        user: { id: "123456789012345678" },
        commandName: "ping",
        client: { ws: { ping: 42 }, guilds: { cache: { get: mock(() => null) } } },
        options: {
            getSubcommand: mock(() => null),
            getString: mock(() => null),
            getUser: mock(() => null),
            getString: mock(() => null)
        },
        isChatInputCommand: () => true,
        isButton: () => false,
        isAutocomplete: () => false,
        isModalSubmit: () => false,
        isAnySelectMenu: () => false,
        isCommand: () => false,
        isRepliable: () => true,
        reply: mock(() => Promise.resolve()),
        editReply: mock(() => Promise.resolve()),
        deferReply: mock(() => Promise.resolve()),
        followUp: mock(() => Promise.resolve()),
        ...overrides
    };
}

export function makeButton(customId: string, overrides: Record<string, any> = {}): any {
    return {
        user: { id: "123456789012345678" },
        customId,
        client: { ws: { ping: 42 }, guilds: { cache: { get: mock(() => null) } } },
        isChatInputCommand: () => false,
        isButton: () => true,
        isAutocomplete: () => false,
        isModalSubmit: () => false,
        isAnySelectMenu: () => false,
        isCommand: () => false,
        isRepliable: () => true,
        reply: mock(() => Promise.resolve()),
        deferUpdate: mock(() => Promise.resolve()),
        editReply: mock(() => Promise.resolve()),
        message: { embeds: [], components: [], delete: mock(() => Promise.resolve()) },
        ...overrides
    };
}

export function makeAutocomplete(focused: string, overrides: Record<string, any> = {}): any {
    return {
        user: { id: "123456789012345678" },
        isChatInputCommand: () => false,
        isButton: () => false,
        isAutocomplete: () => true,
        isModalSubmit: () => false,
        isAnySelectMenu: () => false,
        isCommand: () => false,
        isRepliable: () => false,
        options: {
            getFocused: mock(() => focused)
        },
        respond: mock(() => Promise.resolve()),
        ...overrides
    };
}

export function makeModalSubmit(customId: string, fields: Record<string, string>, overrides: Record<string, any> = {}): any {
    return {
        user: { id: "123456789012345678" },
        customId,
        isChatInputCommand: () => false,
        isButton: () => false,
        isAutocomplete: () => false,
        isModalSubmit: () => true,
        isAnySelectMenu: () => false,
        isCommand: () => false,
        isRepliable: () => true,
        fields: {
            getTextInputValue: mock((key: string) => fields[key] ?? "")
        },
        reply: mock(() => Promise.resolve()),
        editReply: mock(() => Promise.resolve()),
        deferReply: mock(() => Promise.resolve()),
        deferUpdate: mock(() => Promise.resolve()),
        ...overrides
    };
}
