import { describe, it, expect, mock, beforeAll } from "bun:test";

const mockDbQuery = mock(() => Promise.resolve([]));

mock.module("../../automata/Database", () => ({
    dbQuery: mockDbQuery,
    dbTransaction: mock(() => Promise.resolve()),
    initDatabase: mock(() => Promise.resolve())
}));

const mockDecrypt = mock((key: string, data: string) => Promise.resolve(
    key.includes("REGISTER") ? `3/seraph/111222333444555666` : "123456789012345678"
));

mock.module("../../utils/crypt", () => ({
    crypt: mock(() => Promise.resolve("encrypted")),
    decrypt: mockDecrypt
}));

const mockUpdateUserRoles = mock(() => Promise.resolve());

mock.module("../../automata/UserService", () => ({
    userService: { updateUserRoles: mockUpdateUserRoles }
}));

import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import makeRegisterRouter from "../../web/endpoints/register";

const fakeClient: any = { guilds: { cache: { get: () => null } } };
const app = express();
app.use(cookieParser());
app.use("/register", makeRegisterRouter(fakeClient));

describe("GET /register/:account", () => {
    beforeAll(() => {
        process.env.ARGOS_REGISTER_PASSWORD = "register_pass";
        process.env.ARGOS_ID_PASSWORD = "id_pass";
    });

    it("missing cookie redirects to /error OOB", async () => {
        const res = await request(app).get("/register/someEncryptedAccount");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
        expect(res.headers.location).toContain("OOB");
    });

    it("invalid format (no /seraph/) redirects to /error OOB", async () => {
        mockDecrypt.mockImplementationOnce(() => Promise.resolve("invalid_no_seraph")); // account decrypt
        const res = await request(app)
            .get("/register/encryptedBadFormat")
            .set("Cookie", "conflux=valid_conflux");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("user not in DB redirects to /error OOB", async () => {
        mockDecrypt
            .mockResolvedValueOnce("3/seraph/111222333444555666") // account
            .mockResolvedValueOnce("123456789012345678");          // conflux
        mockDbQuery.mockResolvedValueOnce([]); // no user
        const res = await request(app)
            .get("/register/validEncryptedAccount")
            .set("Cookie", "conflux=valid_conflux");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("updates destiny_id and membership_type then redirects to /panel", async () => {
        mockDecrypt
            .mockResolvedValueOnce("3/seraph/111222333444555666") // account decrypt → type/seraph/id
            .mockResolvedValueOnce("123456789012345678");          // conflux decrypt
        mockDbQuery
            .mockResolvedValueOnce([{ discord_id: "123456789012345678" }]) // SELECT user
            .mockResolvedValueOnce([]);                                       // UPDATE
        const res = await request(app)
            .get("/register/validEncryptedAccount")
            .set("Cookie", "conflux=valid_conflux");
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/panel");
        const updateCall = mockDbQuery.mock.calls.find((c: any[]) => c[0].includes("UPDATE users"));
        expect(updateCall).toBeDefined();
        expect(updateCall![1]).toContain("111222333444555666"); // destiny_id
        expect(updateCall![1]).toContain("3");                   // membership_type
    });
});
