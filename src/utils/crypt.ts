import "dotenv/config";
import {webcrypto} from "node:crypto";
const crypt = (data) => {
    return new Promise(async (res, rej) => {
        const cryptkey = process.env.cryptkey as string;
        if(!cryptkey) rej("No cryptkey present in env.");
        const algorithm = {iv: webcrypto.getRandomValues(new Uint8Array(12)), name: "AES-GCM"};
        const key = await webcrypto.subtle.importKey(
            "raw",
            new Uint8Array(atob(cryptkey).split("").map(x => x.charCodeAt(0))),
            "AES-GCM",
            false,
            [
                "encrypt",
                "decrypt"
            ]
        ).catch(e => rej(e));
        const cryptedData = await webcrypto.subtle.encrypt(
            algorithm,
            key!,
            new TextEncoder().encode(data)
        ).catch(e => rej(e));
        const exportData = new Uint8Array(algorithm.iv.byteLength + cryptedData!.byteLength);
        exportData.set(algorithm.iv);
        exportData.set(new Uint8Array(cryptedData!), algorithm.iv.byteLength);
        res(btoa(String.fromCharCode.apply(null, exportData)));
    });
};

const decrypt = (encodedData): Promise<string> => {
    return new Promise(async (res, rej) => {
        const cryptkey = process.env.cryptkey as string;
        if(!cryptkey) rej("No cryptkey present in env.");
        const algorithm = {iv: encodedData.subarray(0, 12), name: "AES-GCM"};
        encodedData = encodedData.subarray(12);
        const key = await webcrypto.subtle.importKey(
            "raw",
            new Uint8Array(atob(cryptkey).split("").map(x => x.charCodeAt(0))),
            "AES-GCM",
            false,
            [
                "encrypt",
                "decrypt"
            ]
        ).catch(e => rej(e));
        const data = await webcrypto.subtle.decrypt(
          algorithm,
          key!,
          encodedData
        ).catch(e => rej(e));
        res(new TextDecoder().decode(data!));
    });
};

export {crypt, decrypt};