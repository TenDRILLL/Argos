import "dotenv/config";
import {webcrypto} from "node:crypto";

const crypt = async (cryptkey: string | undefined, data: string): Promise<string> => {
    if(!cryptkey) throw new Error("No cryptkey provided.");
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const algorithm = {iv, name: "AES-GCM"};
    const key = await webcrypto.subtle.importKey(
        "raw",
        new Uint8Array(atob(cryptkey).split("").map(x => x.charCodeAt(0))),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    );
    const cryptedData = await webcrypto.subtle.encrypt(algorithm, key, new TextEncoder().encode(data));
    const exportData = new Uint8Array(iv.byteLength + cryptedData.byteLength);
    exportData.set(iv);
    exportData.set(new Uint8Array(cryptedData), iv.byteLength);
    return btoa(String.fromCharCode.apply(null, Array.from(exportData)));
};

const decrypt = async (cryptkey: string | undefined, encodedData: string): Promise<string> => {
    if(!cryptkey) throw new Error("No cryptkey provided.");
    const raw = new Uint8Array(atob(encodedData).split("").map(x => x.charCodeAt(0)));
    const algorithm = {iv: raw.subarray(0, 12), name: "AES-GCM"};
    const payload = raw.subarray(12);
    const key = await webcrypto.subtle.importKey(
        "raw",
        new Uint8Array(atob(cryptkey).split("").map(x => x.charCodeAt(0))),
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    );
    const data = await webcrypto.subtle.decrypt(algorithm, key, payload);
    return new TextDecoder().decode(data);
};

export {crypt, decrypt};
