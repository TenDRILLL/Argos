import { describe, it, expect, beforeAll } from "bun:test";
import { webcrypto } from "node:crypto";
import { crypt, decrypt } from "../../utils/crypt";

let testKey: string;

beforeAll(async () => {
    const key = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = await webcrypto.subtle.exportKey("raw", key);
    testKey = btoa(String.fromCharCode(...Array.from(new Uint8Array(raw))));
});

describe("crypt()", () => {
    it("encrypts a string and returns base64", async () => {
        const result = await crypt(testKey, "hello");
        expect(typeof result).toBe("string");
        expect(() => atob(result)).not.toThrow();
    });

    it("produces different ciphertext on each call (random IV)", async () => {
        const a = await crypt(testKey, "hello");
        const b = await crypt(testKey, "hello");
        expect(a).not.toBe(b);
    });

    it("handles empty string input", async () => {
        const result = await crypt(testKey, "");
        expect(typeof result).toBe("string");
    });

    it("handles unicode input", async () => {
        const result = await crypt(testKey, "Guardian#1234 🎮");
        expect(typeof result).toBe("string");
    });

    it("with undefined key throws (not silently resolves undefined)", async () => {
        // regression: execution-after-reject in crypt
        await expect(crypt(undefined, "hello")).rejects.toThrow();
    });
});

describe("decrypt()", () => {
    it("round-trips crypt() output back to original plaintext", async () => {
        const original = "Guardian#1234";
        const encrypted = await crypt(testKey, original);
        const decrypted = await decrypt(testKey, encrypted);
        expect(decrypted).toBe(original);
    });

    it("with undefined key throws", async () => {
        const encrypted = await crypt(testKey, "hello");
        await expect(decrypt(undefined, encrypted)).rejects.toThrow();
    });

    it("with tampered ciphertext throws (AES-GCM auth tag fails)", async () => {
        // regression: execution-after-reject in decrypt
        const encrypted = await crypt(testKey, "hello");
        const raw = atob(encrypted);
        const tampered = btoa(raw.slice(0, -1) + String.fromCharCode(raw.charCodeAt(raw.length - 1) ^ 0xff));
        await expect(decrypt(testKey, tampered)).rejects.toBeDefined();
    });

    it("with wrong key throws", async () => {
        const encrypted = await crypt(testKey, "hello");
        const wrongKey = await webcrypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const wrongRaw = await webcrypto.subtle.exportKey("raw", wrongKey);
        const wrongKeyB64 = btoa(String.fromCharCode(...Array.from(new Uint8Array(wrongRaw))));
        await expect(decrypt(wrongKeyB64, encrypted)).rejects.toBeDefined();
    });
});
