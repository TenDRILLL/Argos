export class vendorQuery {
    vendor: {
        data: vendorComponent;
        privacy: number;
        disabled: boolean;
    }
    categories: Object;
    sales: {
        data: vendorSaleComponent[];
        privary; number;
        disabled; boolean;
    };
    itemComponents: Object;
    currencyLookups: Object;
}

export class vendorComponent {
    canPurchase: boolean;
    progression: Object;
    vendorLocationIndex: number;
    seasonalRank: number;
    vendorHash: number;
    nextRefreshDate: string;
    enabled: boolean;
}

export class vendorSaleComponent {
    saleStatus: number;
    requiredUnlocks: number[];
    unlockStatuses: Object[];
    failureIndexes: number[];
    augments: number;
    itemValueVisibility: boolean[];
    vendorItemIndex: number;
    itemHash: number;
    overrideStyleItemHash: number;
    quantity: number;
    costs: Object[];
    overrideNextRefreshDate: string;
    apiPurchasable: boolean;
}