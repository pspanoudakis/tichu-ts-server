/** Possible card colors. */
export const cardColors = {
    BLACK: 'black',
    RED: 'red',
    BLUE: 'blue',
    GREEN: 'green'
}

// Storing color values here since they are widely used by the app.
export const cardColorValues = Object.values(cardColors);

/** Each letter card title is mapped to its value here. */
export const letterValues: Map<string, number> = new Map(Object.entries({
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14,
}));

export const normalCardKeys = (function () {
    let arr = [];
    for (let i = 2; i <= 10; i++) arr.push(i.toString());
    return arr;
})();
export const reversedCardKeys = Array.from(normalCardKeys).reverse();

/** Special card titles. */
export const specialCards = {
    DOGS: 'Dogs',
    PHOENIX: 'Phoenix',
    MAHJONG: 'Mahjong',
    DRAGON: 'Dragon'
};
export const specialCardNames = Object.values(specialCards);

export function getValueByCardName(name: string) {
    return letterValues.get(name) ?? (function () {
        const n = Number(name);
        if (n < 2 || n > 10 || isNaN(n)) 
            throw new UnknownCardNameError(name);
        return n;
    })();
}

/**
 * Represents a specific Card, along with its information.
 */
export class CardInfo {
    /** The card 'title' (letter, number or special name). */
    name: string;
    /** The value of the card. */
    value: number;
    /** The value of the card (see {@link cardColors}) */
    color: string | '';
    /**
     * The unique key of the card. This is used by the client to refer
     * e.g. to the selected cards to be played.
     */
    key: string;
    /** Indicates whether the card is currently selected or not. */
    isSelected = false;

    constructor(name: string, color = '') {
        switch (name) {
            case specialCards.DOGS:
                this.key = specialCards.DOGS;
                /** By the book, Dogs card has zero value, but this tweak
                 * simplifies the combination logic. */
                this.value = -2;
                break;
            case specialCards.PHOENIX:
                this.key = specialCards.PHOENIX;
                this.value = 0.5;
                break;
            case specialCards.MAHJONG:
                this.key = specialCards.MAHJONG;
                this.value = 1;
                break;
            case specialCards.DRAGON:
                this.key = specialCards.DRAGON;
                this.value = 20;
                break;
            default:
                this.value = getValueByCardName(name);
                this.key = name + "_" + color;
                break;
        }
        this.name = name;
        this.color = color;
    };

    /**
     * Compares the given cards (their values).
     * 
     * If one of the given cards is the Phoenix, its temp value will be evaluated.
     * 
     * @returns `0` if they are equal, `> 0` if a > b, else `< 0`.
     */
    static compareCards(a: CardInfo, b: CardInfo) {
        let valueA = a.value;
        let valueB = b.value;
        if (a instanceof PhoenixCard) {
            valueA = a.tempValue;
        }
        else if (b instanceof PhoenixCard) {
            valueB = b.tempValue;
        }
        return valueB - valueA;
    }

    /**
     * Returns the total points of the specified cards.
     */
    static evaluatePoints(cards: readonly CardInfo[]) {
        let points = 0;
        for (const card of cards) {
            switch (card.name) {
                case '5':
                    points += 5;
                    break;
                case '10':
                case 'K':
                    points += 10;
                    break;
                case specialCards.DRAGON:
                    points += 25;
                    break;
                case specialCards.PHOENIX:
                    points -= 25;
                    break;
                default:
                    break;
            }
        }

        return points;
    }
};

/**
 * Represents the Phoenix special card.
 * 
 * The Phoenix may be used as a replacement to a normal card, so it has
 * extra slots to store the information of the card it replaces.
 * It may not be used to replace a card with specific color.
 */
export class PhoenixCard extends CardInfo {
    tempValue: number;
    tempName: string;

    constructor() {
        super(specialCards.PHOENIX);
        this.tempName = '';
        this.tempValue = 0.5;
    }
}

/**
 * Signals that an unknown card name was found.
 */
class UnknownCardNameError extends Error {
    constructor(unknownName: string) {
        super(`Unknown Card Name: ${unknownName}`);
    }
}
