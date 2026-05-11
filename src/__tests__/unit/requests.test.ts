import { describe, it, expect } from "bun:test";
import { getRequest } from "../../enums/requests";

const ROOT = "https://www.bungie.net/platform";

describe("getRequest()", () => {
    it("returns undefined for unknown endpoint", () => {
        expect(getRequest("notAnEndpoint", {})).toBeUndefined();
    });

    it("substitutes single path param", () => {
        const url = getRequest("getBungieProfile", { id: "12345" });
        expect(url).toBe(`${ROOT}/User/GetBungieNetUserById/12345/`);
    });

    it("substitutes multiple path params", () => {
        const url = getRequest("getDestinyCharacters", { membershipType: 3, destinyMembershipId: "abc" });
        expect(url).toBe(`${ROOT}/Destiny2/3/Account/abc/Stats/`);
    });

    it("preserves query string after param substitution", () => {
        const url = getRequest("getDestinyProfile", { membershipType: 3, destinyMembershipId: "abc" });
        expect(url).toContain("?components=100");
    });

    it("getProfileInventory includes components 200,201,205,102 (updated this session)", () => {
        const url = getRequest("getProfileInventory", { membershipType: 3, destinyMembershipId: "abc" });
        expect(url).toContain("components=200,201,205,102");
        expect(url).toContain("/3/Profile/abc/");
    });

    it("transferItem — static POST endpoint, no path params", () => {
        const url = getRequest("transferItem", {});
        expect(url).toBe(`${ROOT}/Destiny2/Actions/Items/TransferItem/`);
    });

    it("equipItems — static POST endpoint, no path params", () => {
        const url = getRequest("equipItems", {});
        expect(url).toBe(`${ROOT}/Destiny2/Actions/Items/EquipItems/`);
    });

    it("getProfileTransitory includes components 204,1000", () => {
        const url = getRequest("getProfileTransitory", { membershipType: 3, destinyMembershipId: "abc" });
        expect(url).toContain("components=204,1000");
        expect(url).toContain("/3/Profile/abc/");
    });

    it("ignores unknown params (not in URL template)", () => {
        const url = getRequest("getBungieProfile", { id: "123", unknownKey: "value" });
        expect(url).toBe(`${ROOT}/User/GetBungieNetUserById/123/`);
        expect(url).not.toContain("unknownKey");
    });

    it("appends query string from 'query' key in data", () => {
        const url = getRequest("getBungieProfile", { id: "123", query: "foo=bar" });
        expect(url).toContain("?foo=bar");
    });

    it("getGroupMembers substitutes groupId", () => {
        const url = getRequest("getGroupMembers", { groupId: "3506545" });
        expect(url).toContain("/3506545/Members/");
    });

    it("getActivityHistory substitutes all three params", () => {
        const url = getRequest("getActivityHistory", {
            membershipType: 3,
            destinyMembershipId: "111",
            characterId: "222"
        });
        expect(url).toContain("/3/Account/111/Character/222/Stats/Activities/");
    });

    it("getProfileRecords substitutes membershipType and destinyMembershipId", () => {
        const url = getRequest("getProfileRecords", { membershipType: 3, destinyMembershipId: "abc123" });
        expect(url).toContain("/3/Profile/abc123/");
    });

    it("getProfileRecords includes components=900", () => {
        const url = getRequest("getProfileRecords", { membershipType: 3, destinyMembershipId: "abc123" });
        expect(url).toContain("components=900");
    });

    it("getProfileRecords returns a defined URL", () => {
        const url = getRequest("getProfileRecords", { membershipType: 1, destinyMembershipId: "xyz" });
        expect(url).toBeDefined();
        expect(url).toContain("https://www.bungie.net/platform");
    });
});
