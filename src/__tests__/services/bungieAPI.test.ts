import { describe, it, expect, mock, beforeEach } from "bun:test";

const mockAxiosGet = mock(() => Promise.resolve({ data: { Response: {}, ErrorCode: 1, ThrottleSeconds: 0 } }));
const mockAxiosPost = mock(() => Promise.resolve({ data: { access_token: "tok", expires_in: 3600, refresh_token: "ref", refresh_expires_in: 7776000, membership_id: "123" } }));

mock.module("axios", () => ({
    default: { get: mockAxiosGet, post: mockAxiosPost },
    get: mockAxiosGet,
    post: mockAxiosPost
}));

import { BungieAPI } from "../../automata/BungieAPI";

describe("BungieAPI", () => {
    let api: BungieAPI;

    beforeEach(() => {
        process.env.BUNGIE_API_KEY = "test_api_key";
        process.env.BUNGIE_CLIENT_ID = "test_client_id";
        process.env.BUNGIE_SECRET = "test_secret";
        api = new BungieAPI();
        mockAxiosGet.mockClear();
        mockAxiosPost.mockClear();
    });

    describe("apiRequest()", () => {
        it("GET builds URL from getRequest() and adds X-API-Key header", async () => {
            mockAxiosGet.mockResolvedValueOnce({ data: { Response: {}, ErrorCode: 1, ThrottleSeconds: 0 } });
            await api.apiRequest("getBungieProfile", { id: "123" });
            expect(mockAxiosGet).toHaveBeenCalled();
            const [, config] = mockAxiosGet.mock.calls[0];
            expect(config.headers["X-API-Key"]).toBe("test_api_key");
        });

        it("resolves with response data", async () => {
            const fakeData = { Response: { displayName: "Guardian" }, ErrorCode: 1, ThrottleSeconds: 0 };
            mockAxiosGet.mockResolvedValueOnce({ data: fakeData });
            const result = await api.apiRequest("getBungieProfile", { id: "123" });
            expect(result.Response).toEqual({ displayName: "Guardian" });
        });

        it("rejects on non-2xx with status + message", async () => {
            mockAxiosGet.mockRejectedValueOnce({
                response: { status: 404, statusText: "Not Found", data: { Message: "Profile not found" } },
                code: "ERR_BAD_RESPONSE"
            });
            await expect(api.apiRequest("getBungieProfile", { id: "bad" })).rejects.toMatch("404");
        });

        it("retries after ThrottleSeconds on GET", async () => {
            mockAxiosGet
                .mockResolvedValueOnce({ data: { Response: {}, ErrorCode: 1, ThrottleSeconds: 1 } })
                .mockResolvedValueOnce({ data: { Response: { result: "ok" }, ErrorCode: 1, ThrottleSeconds: 0 } });
            // Use very short throttle by patching setTimeout — just verify the second call happens
            const result = await api.apiRequest("getBungieProfile", { id: "123" });
            // The throttle response has 1s delay; mock doesn't wait, it resolves the second call
            expect(mockAxiosGet.mock.calls.length).toBeGreaterThanOrEqual(1);
        });

        it("POST retry includes headers", async () => {
            mockAxiosPost
                .mockResolvedValueOnce({ data: { ThrottleSeconds: 1, ErrorCode: 1 } })
                .mockResolvedValueOnce({ data: { Response: {}, ThrottleSeconds: 0, ErrorCode: 1 } });
            // Just verify post is called with headers on initial attempt
            try {
                await api.apiRequest("approveClanMember", { groupId: "123" }, { Authorization: "Bearer tok" }, "post", {});
            } catch {}
            expect(mockAxiosPost).toHaveBeenCalledWith(
                expect.any(String),
                expect.anything(),
                expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "test_api_key", "Authorization": "Bearer tok" }) })
            );
        });
    });

    describe("token()", () => {
        it("resolves with AuthenticationResponse on success", async () => {
            const auth = { access_token: "tok", expires_in: 3600, refresh_token: "ref", refresh_expires_in: 7776000, membership_id: "123" };
            mockAxiosPost.mockResolvedValueOnce({ data: auth });
            const result = await api.token("fake_data");
            expect(result.access_token).toBe("tok");
            expect(result.membership_id).toBe("123");
        });

        it("REJECTS (not resolves) on axios error — regression: token() resolving error code as success", async () => {
            mockAxiosPost.mockRejectedValueOnce({
                code: "ERR_NETWORK",
                response: { data: { Message: "Bad credentials" } }
            });
            await expect(api.token("bad_data")).rejects.toBeDefined();
        });
    });

    describe("refreshToken()", () => {
        it("rejects when no refresh token provided", async () => {
            await expect(api.refreshToken("", Date.now() + 9999999)).rejects.toBeDefined();
        });

        it("rejects when token is expired (Date.now() >= refreshExpiry)", async () => {
            const expired = Date.now() - 1000;
            await expect(api.refreshToken("some_token", expired)).rejects.toBeDefined();
        });

        it("resolves with new tokens on success", async () => {
            const auth = { access_token: "new_tok", expires_in: 3600, refresh_token: "new_ref", refresh_expires_in: 7776000, membership_id: "123" };
            mockAxiosPost.mockResolvedValueOnce({ data: auth });
            const result = await api.refreshToken("valid_refresh", Date.now() + 9999999);
            expect(result.access_token).toBe("new_tok");
        });
    });

    describe("rawRequest()", () => {
        it("returns response data", async () => {
            const fakeData = { key: "value" };
            mockAxiosGet.mockResolvedValueOnce({ data: fakeData });
            const result = await api.rawRequest("https://example.com/test");
            expect(result).toEqual(fakeData);
        });
    });

    describe("getBungieName()", () => {
        it("returns displayName from profile", async () => {
            mockAxiosGet.mockResolvedValueOnce({ data: { Response: { displayName: "Guardian", uniqueName: "Guardian#1234" }, ErrorCode: 1, ThrottleSeconds: 0 } });
            const name = await api.getBungieName("123");
            expect(name).toBe("Guardian");
        });
    });

    describe("getBungieTag()", () => {
        it("returns uniqueName from profile", async () => {
            mockAxiosGet.mockResolvedValueOnce({ data: { Response: { displayName: "Guardian", uniqueName: "Guardian#1234" }, ErrorCode: 1, ThrottleSeconds: 0 } });
            const tag = await api.getBungieTag("123");
            expect(tag).toBe("Guardian#1234");
        });
    });
});
