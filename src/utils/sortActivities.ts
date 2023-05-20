import { ActivityObject } from "../props/dbUser";

export function sortActivities(activities: ActivityObject): Map<string, string[]> {
    const keys = Object.keys(activities);
    const sorted = Object.keys(activities).sort((a,b) => activities[b]-activities[a]).filter(a => !a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Heroic"))
    const size = sorted.filter(a => activities[a] !== 0 && (!a.endsWith("Master") && !a.endsWith("Prestige") && !a.endsWith("Prestige"))).length;
    const ans: Map<string, string[]> = new Map();
    let i = 0
    while (i !== size) {
        if (ans[sorted[i]] == undefined) ans[sorted[i]] = [];
        ans[sorted[i]].push(activities[sorted[i]] as unknown as string)
        if (keys.includes(`${sorted[i]}, Master`)) {
            ans[sorted[i]].push(`Master`, activities[`${sorted[i]}, Master`]);
        }
        else if (keys.includes(`${sorted[i]}, Heroic`)) {
            ans[sorted[i]].push(`Heroic`, activities[`${sorted[i]}, Heroic`]);
        }
        else if (keys.includes(`${sorted[i]}, Prestige`)) {
            ans[sorted[i]].push(`Prestige`, activities[`${sorted[i]}, Prestige`]);
        }
        i += 1;
    }
    return ans;
}