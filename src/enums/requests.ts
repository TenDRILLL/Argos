const apiRoot = "https://www.bungie.net/platform";

const requests = new Map();
requests.set("getBungieProfile","/User/GetBungieNetUserById/id");
requests.set("getBungieLinkedProfiles","/Destiny2/membershipType/Profile/membershipId/LinkedProfiles");
requests.set("getDestinyCharacters","/Destiny2/membershipType/Account/destinyMembershipId/Stats/");
requests.set("getDestinyProfile", "/Destiny2/membershipType/Profile/destinyMembershipId?components=100");
requests.set("getDestinyMetrics","/Destiny2/membershipType/Profile/destinyMembershipId?components=205");
requests.set("getDestinyInventory", "/Destiny2/membershipType/Profile/destinyMembershipId/Character/characterId/?components=200,205")
requests.set("getActivityStats","/Destiny2/membershipType/Account/destinyMembershipId/Character/characterId/Stats/AggregateActivityStats");
requests.set("getWeaponStats","/Destiny2/membershipType/Account/destinyMembershipId/Character/characterId/Stats/UniqueWeapons");
requests.set("getEntity","/Destiny2/Manifest/DestinyInventoryItemDefinition/hashIdentifier/");
requests.set("getManifests","/Destiny2/Manifest/");
requests.set("getDestinyEntityDefinition","/Destiny2/Manifest/entityType/hashIdentifier");
requests.set("getGroupMembers", "/GroupV2/groupId/Members/");
requests.set("getPendingClanInvites", "/GroupV2/groupId/Members/Pending/");
requests.set("approveClanMember","/GroupV2/groupId/Members/ApproveList/");
requests.set("denyClanMember","/GroupV2/groupId/Members/DenyList/");
requests.set("getVendorSales", "/Destiny2/membershipType/Profile/destinyMembershipId/Character/characterId/Vendors/vendorHash/?components=402");
requests.set("getVendorInformation", "/Destiny2/membershipType/Profile/destinyMembershipId/Character/characterId/Vendors/vendorHash/?components=300,304,305,310,400,401,402");
requests.set("getActivityHistory", "/Destiny2/membershipType/Account/destinyMembershipId/Character/characterId/Stats/Activities/")
requests.set("getPostGameCarnageReport", "/Destiny2/Stats/PostGameCarnageReport/activityId/")
requests.set("getItem", "/Destiny2/membershipType/Profile/destinyMembershipId/Item/itemInstanceId/?components=300,301,302,303,304,305,306,307,308,309,310")

export function getRequest(id,data){
    if(requests.has(id)){
        let request = requests.get(id);
        let queryParams = null;
        if(data){
            let comps = request.split("?").splice(1);
            request = request.split("?")[0].split("/");
            Object.keys(data).forEach(key => {
                if(request.includes(key)){
                    request[request.indexOf(key)] = data[key];
                }
                if(key === "query"){
                    queryParams = data[key];
                }
            });
            request = request.join("/");
            if(comps.length > 0){
                request = [request,comps].join("?");
            }
        }
        return `${apiRoot}${queryParams !== null ? request + "?" + queryParams : request}`;
    }
}
