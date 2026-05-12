import * as cron from "node-cron";
import { Client, ActivityType } from "discord.js";
import DiscordEvent from "../../structs/DiscordEvent";
import { userService } from "../../automata/UserService";
import { generateXurEmbed, deleteXurEmbed } from "../../utils/getXurEmbed";
import { fetchPendingClanRequests } from "../../utils/fetchPendingClanRequests";
import { manifestCache } from "../../automata/ManifestCache";
import { weaponEmojiService } from "../../automata/WeaponEmojiService";

const ARGOS_STATUSES = [
    "Scanning for Vex signatures",
    "Monitoring the Infinite Forest",
    "Charging the Planetary Core",
    "Calibrating Vex radiolaria levels",
    "Synchronizing with the Lattice",
    "Purging unauthorized Guardians",
    "Tracking Guardian incursions",
    "Calculating simulation parameters",
    "Analyzing Vex network traffic",
    "Defending the Planetary Core",
    "Processing Vex gate protocols",
    "Overseeing the Eater of Worlds",
    "Cataloguing Guardian casualties",
    "Warming up deletion beams",
    "Observing time-stream anomalies",
    "Cross-referencing Guardian threats",
    "Optimizing core detonation sequence",
    "Running Vex prediction matrices",
    "Realigning orbital strike arrays",
    "Monitoring simulation integrity",
];

function scheduleNextStatus(client: Client): void {
    const ms = (5 + Math.random() * 295) * 60 * 1000;
    setTimeout(() => {
        const status = ARGOS_STATUSES[Math.floor(Math.random() * ARGOS_STATUSES.length)];
        client.user?.setActivity(status, { type: ActivityType.Playing });
        scheduleNextStatus(client);
    }, ms);
}

export default class ReadyEvent extends DiscordEvent {
    constructor() {
        super("ready", true);
    }

    exec(client: Client) {
        console.log("Ready.");
        console.log(`Logged in as ${client.user?.tag}`);

        const initialStatus = ARGOS_STATUSES[Math.floor(Math.random() * ARGOS_STATUSES.length)];
        client.user?.setActivity(initialStatus, { type: ActivityType.Playing });
        scheduleNextStatus(client);

        manifestCache.refresh().catch(e => console.error("ManifestCache refresh failed:", e));
        weaponEmojiService.syncEmojis(client).catch(e => console.error("WeaponEmojiService sync failed:", e));

        setInterval(async () => {
            console.log(`Time: ${new Date().toUTCString()}`);
            console.log("Updating clanmember list.");
            await userService.updateClanMembers();
            console.log("Updating statroles.");
            await userService.updateAllUserRoles(client);
            console.log("Checking clan requests.");
            await fetchPendingClanRequests(client);
        }, 5 * 60 * 1000);

        const createXur = cron.schedule("5 17 * * 5", () => {
            generateXurEmbed(client);
        }, { timezone: "Etc/UTC" });

        const deleteXur = cron.schedule("5 17 * * 2", () => {
            deleteXurEmbed(client);
            manifestCache.refresh().catch(e => console.error("ManifestCache weekly refresh failed:", e));
        }, { timezone: "Etc/UTC" });

        createXur.start();
        deleteXur.start();

        const now = new Date();
        // 0 = Sun, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri
        if (now.getDay() !== 3 && now.getDay() !== 4) {
            if (now.getDay() === 2) {
                if (now.getUTCHours() >= 17) {
                    deleteXurEmbed(client);
                } else {
                    generateXurEmbed(client);
                }
            } else if (now.getDay() === 5) {
                if (now.getUTCHours() < 17) {
                    deleteXurEmbed(client);
                } else {
                    generateXurEmbed(client);
                }
            } else {
                generateXurEmbed(client);
            }
        } else {
            deleteXurEmbed(client);
        }
    }
}
