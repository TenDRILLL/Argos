import { describe, it, expect } from "bun:test";
import request from "supertest";
import express from "express";
import catchallRouter from "../../web/endpoints/catchall";

const app = express();
app.use(catchallRouter);

describe("catchall router", () => {
    it("GET /unknown redirects to /error", async () => {
        const res = await request(app).get("/unknown");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("GET /some/deep/path redirects to /error", async () => {
        const res = await request(app).get("/some/deep/path");
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain("/error");
    });

    it("redirect includes OOB code", async () => {
        const res = await request(app).get("/notfound");
        expect(res.headers.location).toContain("OOB");
    });
});
