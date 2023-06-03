import {DestinyUserInfo} from "./bungieGroupQuery";

export class DestinyProfileQuery {
    responseMintedTimestamp: string;
    secondaryComponentsMintedTimestamp: string;
    profile: {
        data: {
            userinfo: DestinyUserInfo,
            dateLastPlayed: string;
            versionsOwned: number;
            characterIds: string[];
            seasonHashes: number[];
            eventCardHashesOwned: number[];
            currentSeasonHash: number;
            currentSeasonRewardPowerCap: number;
            activeEventCardHash: number;
            currentGuardianRank: number;
            lifetimeHighestGuardianRank: number;
        };
        privacy: number;
    }
}