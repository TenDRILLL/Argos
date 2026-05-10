import type { LFGPost } from "../automata/LFGManager";

export const fixtureLFGPost: LFGPost = {
    id: "1234567890&9876543210",
    activity: "Last Wish",
    timeString: "Friday 8PM",
    time: Math.floor(Date.now() / 1000) + 7200,
    maxSize: 6,
    creator: "123456789012345678",
    guardians: ["123456789012345678"],
    queue: [],
    desc: "Fresh run, no experience needed."
};
