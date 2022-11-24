export class CharacterQuery {
    mergedDeletedCharacters: Object;
    mergedAllCharacters: Object;
    characters: Character[];
}

export class Character {
    characterId: string;
    deleted: boolean;
    results: Object;
    merged: Object;
}