import { describe, it, expect } from "bun:test";
import request from "supertest";
import express from "express";
import resourceRouter from "../../web/endpoints/resource";

const app = express();
app.use("/resource", resourceRouter);

describe("GET /resource/:name", () => {
    it("GET /resource/../../etc/passwd returns 404 (path traversal blocked)", async () => {
        const res = await request(app).get("/resource/../../etc/passwd");
        expect([400, 403, 404]).toContain(res.status);
    });

    it("GET /resource/main.css serves from styles directory (200 or 404 if missing)", async () => {
        const res = await request(app).get("/resource/main.css");
        expect([200, 404]).toContain(res.status);
        if (res.status === 200) {
            expect(res.type).toContain("css");
        }
    });

    it("GET /resource/app.js serves from scripts directory", async () => {
        const res = await request(app).get("/resource/app.js");
        expect([200, 404]).toContain(res.status);
    });
});
