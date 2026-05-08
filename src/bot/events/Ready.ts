import * as cron from "node-cron";
import { Client } from "discord.js";
import DiscordEvent from "../../structs/DiscordEvent";
import { userService } from "../../automata/UserService";
import { generateXurEmbed, deleteXurEmbed } from "../../utils/getXurEmbed";
import { fetchPendingClanRequests } from "../../utils/fetchPendingClanRequests";

export default class ReadyEvent extends DiscordEvent {
    constructor() {
        super("ready", true);
    }

    exec(client: Client) {
        console.log(`Ready! Logged in as ${client.user?.tag}`);

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
