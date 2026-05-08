export class VendorQuery {
    vendor: {
        data: VendorComponent;
        privacy: number;
        disabled: boolean;
    }
    categories: {
        data: {
            categories: VendorCategories[]
        };
        privacy: number;
        disabled: boolean;
    }
    sales: {
        data: VendorSaleComponent[];
        privacy: number;
        disabled: boolean;
    };
    itemComponents: {
        instances: {
            data: [string: Object][];
            privacy: number;
        }
        sockets: {
            data: ItemComponentSocket;
            privacy: number;
            disabled: boolean;
        }
        stats: {
            data: {
                [key: string]: {
                    stats: {
                        [key: string]: {
                            statHash: number;
                            value: number;
                        }
                    }
                }
            }
            privacy: number;
        }
    }
    currencyLookups: Object;
}

export class ItemComponentSocket {
    sockets: SocketComponents[];
}

export class SocketComponents {
    plugHash: number;
    isEnabled: boolean;
    isVisible: boolean;
    enableFailIndexes: number[];
}

export class VendorCategories {
    displayCategoryIndex: number;
    itemIndexes: number[];
}

export class VendorComponent {
    canPurchase: boolean;
    progression: Object;
    vendorLocationIndex: number;
    seasonalRank: number;
    vendorHash: number;
    nextRefreshDate: string;
    enabled: boolean;
}

export class VendorSaleComponent {
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
