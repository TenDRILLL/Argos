export class vendorQuery {
    vendor: {
        data: vendorComponent;
        privacy: number;
        disabled: boolean;
    }
    categories: {
        data: {
            categories: vendorCategories[]
        };
        privacy: number;
        disabled: boolean;
    }
    sales: {
        data: vendorSaleComponent[];
        privary; number;
        disabled; boolean;
    };
    itemComponents: {
        instances: {
            data: [string: Object][];
            privacy: number;
        }
        sockets: {
            data: itemComponentSocket[];
            
            privacy: number;
            disabled: boolean;
        }
    }
    currencyLookups: Object;
}

export class itemComponentSocket {
    sockets: socketComponents;
}

export class socketComponents {
    plugHash: number;
        isEnabled: boolean;
        isVisible: boolean;
        enableFailIndexes: number[];
}

export class vendorCategories {
    displayCategoryIndex: number;
    itemIndexes: number[];
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