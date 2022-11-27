export class WeaponQuery {
    weapons: WeaponStat[];
}

export class WeaponStat {
    referenceId: number;
    values: WeaponStatValue;
}

export class WeaponStatValue {
    uniqueWeaponAssists: WeaponStatValueObject;
    uniqueWeaponAssistDamage: WeaponStatValueObject;
    uniqueWeaponKills: WeaponStatValueObject;
    uniqueWeaponPrecisionKills: WeaponStatValueObject;
    uniqueWeaponKillsPrecisionKills: WeaponStatValueObject;
}

export class WeaponStatValueObject {
    statId: string;
    basic: {
        value: number;
        displayValue: string;
    }
}

export class weaponDatabaseObject {
    Name: String;
    Type: String;
}