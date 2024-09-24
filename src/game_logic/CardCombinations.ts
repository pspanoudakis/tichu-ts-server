/** Helper interfaces for combination methods */

import { cardColorValues, getNormalCardValueByName, normalCardKeys, specialCardNames, SpecialCards } from "./CardConfig";
import { CardInfo, PhoenixCard } from "./CardInfo";

interface CardColorOccurencesMap {
    [cardName: string]: Map<string, boolean>;
}

interface CardNameOccurencesMap {
    [cardName: string]: number;
}

/** Helper function for some `CardCombination` subclasses methods.
 * @returns `true` if `target` is between [`a`, `b`], else `false`.
 */
function isBetween(target: number, a: number, b: number) {
    return target >= a && target <= b;
}

/** Possible card combination types. */
export enum CardCombinationType {
    KENTA = 'Kenta',
    FULLHOUSE = 'FullHouse',
    STEPS = 'Steps',
    TRIPLET = 'Triplet',
    COUPLE = 'Couple',
    SINGLE = 'Single',
    BOMB = 'Bomb'
}

/**
 * Represents a **valid** combination of 1 or more cards.
 */
export abstract class CardCombination {

    /** The combination type (see {@link CardCombinationType}) */
    type: CardCombinationType;
    /** The number of cards in the combination */
    length: number;
    /** The value of the top card in the combination */
    value: any;

    /** Creates a `CardCombination` with the given information. */
    constructor(combination: CardCombinationType, len: number, val: any) {
        this.type = combination;
        this.length = len;
        this.value = val;
    }
    /** 
     * Compares the provided combinations (used for constant length combination types).
     * @returns `0` if their values are equal, `> 0` if a > b, else `< 0`.
     */
    static basicCompare(a: CardCombination | null, b: CardCombination | null) {
        if (a === b) {
            return 0;
        }
        if (a === null) {
            return -1;
        }
        if (b === null) {
            return 1;
        }
        return a.value - b.value;
    }
    /** 
     * Compares the provided combinations (used for variant length combination types).
     * 
     * @returns `0` if their values are equal or their lengths are different,
     * `> 0` if a > b, else `< 0`.
     */
    static altCompare(a: CardCombination | null, b: CardCombination | null) {
        if (a === b) {
            return 0;
        }
        if (a === null) {
            return -1;
        }
        if (b === null) {
            return 1;
        }
        if (a.length !== b.length) {
            return 0;
        }
        return a.value - b.value;
    }
    /** 
     * Compares `this` to another possible combination. 
     * @returns `0` if they are equal or incomparable, `> 0` if `this` is stronger, else `< 0`.
     */
    abstract compareCombination(other: CardCombination | null): number;
    /**
     * Compares `this` to the strongest possible, same type combination which contains
     * the requested card and has the given length (if specified),
     * that can be created from the given cards.
     * @returns `0` if they are equal or incomparable, `> 0` if `this` is stronger, else `< 0`.
     * 
     * @param cards The cards available to create the other combination.
     * @param requested The name of the card that must be present in the combination.
     * @param length If specified, the created combination must have this length.
     */
    abstract compare(cards: Array<CardInfo>, requested: string, length?: number): number;
}

/**
 * Represents a combination with just one card (no restrictions).
 */
export class SingleCard extends CardCombination {
    constructor(cardValue: number) {
        super(CardCombinationType.SINGLE, 1, cardValue);
    }

    /**
     * Attempts to find the strongest `SingleCard` that can be created from
     * the given cards, which includes the requested card.
     * Essentially, it will be found if this card exists in the array.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `SingleCard` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requested: string) {
        const target = cards.find(card => card.name === requested);
        return (target !== undefined) ? new SingleCard(target.value) : null;
    }

    compareCombination(other: SingleCard | null) {
        return CardCombination.basicCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string) {
        return CardCombination.basicCompare(
            this, SingleCard.getStrongestRequested(cards, requested)
        );
    }
}

/** 
 * Represents a combination of 2 cards with the same value.
 * No {@link SpecialCards} apart from the Phoenix may participate.
*/
export class CardCouple extends CardCombination {
    constructor(cardValue: number) {
        super(CardCombinationType.COUPLE, 2, cardValue);
    }
    /**
     * Attempts to find the strongest `CardCouple` that can be created from
     * the given cards, which includes the requested card.
     * Essentially, it will be found if a `CardCouple` containing this card
     * can be created.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `CardCouple` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requestedCard: string) {
        let hasPhoenix = cards.some(card => card.name === SpecialCards.Phoenix);
        let targetCards = cards.filter(card => card.name === requestedCard);
        if (targetCards.length >= 2 ||
            (targetCards.length === 1 && hasPhoenix)) {
            return new CardCouple(getNormalCardValueByName(requestedCard));
        }
        return null;
    }
    /**
     * Attempts to create a `CardCouple` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `CardCouple` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static create(cards: Array<CardInfo>) {
        if (cards.length !== 2) {
            return null;
        }
        if (cards[0].name !== cards[1].name) {
            const phoenixIndex =
                cards.findIndex(card => card.name === SpecialCards.Phoenix);
            if (phoenixIndex !== -1) {
                const otherIndex = (phoenixIndex + 1) % 2;
                if (!specialCardNames.includes(cards[otherIndex].name)) {
                    return new CardCouple(cards[otherIndex].value);
                }
            }
            return null;
        }
        return new CardCouple(cards[0].value);
    }
    compareCombination(other: CardCouple | null) {
        return CardCombination.basicCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string) {
        return CardCombination.basicCompare(
            this, CardCouple.getStrongestRequested(cards, requested)
        );
    }
}

/** 
 * Represents a combination of 3 cards with the same value.
 * No {@link SpecialCards} apart from the Phoenix may participate.
 */
export class Triplet extends CardCombination {
    constructor(cardValue: number) {
        super(CardCombinationType.TRIPLET, 3, cardValue);
    }
    /**
     * Attempts to find the strongest `Triplet` that can be created from
     * the given cards, which includes the requested card.
     * Essentially, it will be found if a `Triplet` containing this card
     * can be created.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `Triplet` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requestedCard: string) {
        let hasPhoenix = cards.some(card => card.name === SpecialCards.Phoenix);
        let targetCards = cards.filter(card => card.name === requestedCard);
        if (targetCards.length >= 3 ||
            (targetCards.length === 2 && hasPhoenix)) {
            return new Triplet(getNormalCardValueByName(requestedCard));
        }
        return null;
    }
    /**
     * Attempts to create a `Triplet` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `Triplet` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static create(cards: Array<CardInfo>) {
        if (cards.length !== 3) {
            return null;
        }
        let filteredCards = cards.filter(card => card.name !== SpecialCards.Phoenix);
        if (filteredCards.some(card => card.name !== filteredCards[0].name)) {
            return null;
        }
        return new Triplet(filteredCards[0].value);
    }
    compareCombination(other: Triplet | null) {
        return CardCombination.basicCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string) {
        return CardCombination.basicCompare(
            this, Triplet.getStrongestRequested(cards, requested)
        );
    }
}


/**
 * Represents a combination of 2 or more consecutive card couples (2 cards with the same value).
 * No {@link SpecialCards} apart from the Phoenix may participate.
 */
export class Steps extends CardCombination {

    constructor(topValue: number, length: number) {
        super(CardCombinationType.STEPS, length, topValue);
    }
    /**
     * Attempts to find the strongest `Steps` combination that can be created from
     * the given cards, which includes the requested card and has the requested length.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `Steps` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requested: string, length: number) {
        if (cards.length >= length) {
            let cardOccurences: Map<string, number> = new Map();
            let phoenixUsed = true;
            for (const card of cards) {
                if (!specialCardNames.includes(card.name)) {
                    let occurences = cardOccurences.get(card.name);
                    if (occurences === undefined) {
                        occurences = 0;
                    }
                    cardOccurences.set(card.name, occurences + 1);
                }
                else if (phoenixUsed) {
                    phoenixUsed = !(card.name === SpecialCards.Phoenix);
                }
            }
            const requestedOccurences = cardOccurences.get(requested);
            if (requestedOccurences !== undefined &&
                (requestedOccurences >= 2 || (requestedOccurences === 1 && !phoenixUsed))) {
                let requestedIndex = normalCardKeys.indexOf(requested);
                let highIndex = Math.min(normalCardKeys.length - 1, requestedIndex + length - 1);
                let lowIndex = highIndex - length + 1;
                while (lowIndex >= 0 && isBetween(requestedIndex, lowIndex, highIndex)) {
                    let phoenixUsedTemp = phoenixUsed;
                    let i = highIndex;
                    for (; i >= lowIndex; i--) {
                        const occurences = cardOccurences.get(normalCardKeys[i]);
                        if (occurences !== undefined) {
                            if (occurences < 2) {
                                if (phoenixUsedTemp) { break; }
                                phoenixUsedTemp = true;
                            }
                        }
                        else { break; }
                    }
                    if (i < lowIndex) {
                        return new Steps(getNormalCardValueByName(normalCardKeys[highIndex]), length);
                    }
                    highIndex = i - 1;
                    lowIndex = highIndex - length + 1;
                }
            }
        }
        return null;
    }
    /**
     * Attempts to create a `Steps` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `Steps` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static create(cards: Array<CardInfo>) {
        if (cards.length >= 4 && cards.length % 2 === 0) {
            let cardOccurences: Map<number, number> = new Map();
            let phoenixUsed = true;
            for (const card of cards) {
                if (specialCardNames.includes(card.name)) {
                    if (card.name !== SpecialCards.Phoenix) {
                        return null;
                    }
                    phoenixUsed = false;
                }
                else {
                    let occurences = cardOccurences.get(card.value);
                    if (occurences === undefined) {
                        occurences = 0;
                    }
                    cardOccurences.set(card.value, occurences + 1);
                }
            }
            const cardOccurencesArray = Array.from(cardOccurences)
            if (cardOccurencesArray.length > 1) {
                let previousValue = cardOccurencesArray[0][0] + 1;
                for (const [cardValue, occurences] of cardOccurencesArray) {
                    if (occurences !== 2) {
                        if (occurences !== 1 || phoenixUsed) {
                            return null;
                        }
                        phoenixUsed = true;
                    }
                    if (previousValue !== cardValue + 1) {
                        return null;
                    }
                    previousValue = cardValue;
                }
                return new Steps(cardOccurencesArray[0][0], cardOccurencesArray.length);
            }
        }
        return null;
    }
    compareCombination(other: Steps | null) {
        return CardCombination.altCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string, length: number) {
        return CardCombination.altCompare(
            this, Steps.getStrongestRequested(cards, requested, length)
        );
    }
}

/**
 * Represents a combination of 5 or more consecutive value cards.
 * No {@link SpecialCards} apart from the Mahjong and the Phoenix may participate.
 */
export class Kenta extends CardCombination {
    constructor(topValue: number, length: number) {
        super(CardCombinationType.KENTA, length, topValue);
    }
    /**
     * Attempts to find the strongest `Kenta` combination that can be created from
     * the given cards, which includes the requested card and has the requested length.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `Kenta` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requested: string, length: number) {
        if (cards.length >= length) {
            let cardOccurences: Map<string, number> = new Map();
            let phoenixUsed = true;
            for (const card of cards) {
                if (!specialCardNames.includes(card.name)) {
                    let occurences = cardOccurences.get(card.name);
                    if (occurences === undefined) {
                        occurences = 0;
                    }
                    cardOccurences.set(card.name, occurences + 1);
                }
                else if (phoenixUsed) {
                    phoenixUsed = !(card.name === SpecialCards.Phoenix);
                }
            }
            if (cardOccurences.get(requested) !== undefined || !phoenixUsed) {
                let requestedIndex = normalCardKeys.indexOf(requested);
                let highIndex = Math.min(normalCardKeys.length - 1, requestedIndex + length - 1);
                let lowIndex = highIndex - length + 1;
                while (lowIndex >= 0 && isBetween(requestedIndex, lowIndex, highIndex)) {
                    let phoenixUsedTemp = phoenixUsed;
                    let i = highIndex;
                    for (; i >= lowIndex; i--) {
                        const occurences = cardOccurences.get(normalCardKeys[i]);
                        if (occurences === undefined) {
                            if (phoenixUsedTemp) { break; }
                            phoenixUsedTemp = true;
                        }
                    }
                    if (i < lowIndex) {
                        return new Kenta(getNormalCardValueByName(normalCardKeys[highIndex]), length);
                    }
                    highIndex = i - 1;
                    lowIndex = highIndex - length + 1;
                }
            }
        }
        return null;
    }
    /**
     * Attempts to create a `Kenta` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `Kenta` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static create(cards: Array<CardInfo>) {
        if (cards.length > 4) {
            let phoenix = cards.find(card => card.name === SpecialCards.Phoenix);
            let topValue = cards[0].value;
            if (phoenix instanceof PhoenixCard) {
                topValue = Math.max(phoenix.tempValue, topValue);
            }
            let expectedValue = topValue + 1;
            for (const card of cards) {
                expectedValue--;
                if (card.value !== expectedValue && card !== phoenix) {
                    if (!(phoenix instanceof PhoenixCard) || phoenix.tempValue !== expectedValue
                        || card.value !== phoenix.tempValue - 1) {

                        return null;
                    }
                    expectedValue = card.value;
                }
            }
            return new Kenta(topValue, cards.length);
        }
        return null;
    }
    compareCombination(other: Kenta | null) {
        return CardCombination.altCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string, length: number) {
        return CardCombination.altCompare(
            this, Kenta.getStrongestRequested(cards, requested, length)
        );
    }
}

/**
 * Represents a combination of a {@link Triplet} and a {@link CardCouple}.
 * No {@link SpecialCards} apart from the Phoenix may participate.
 */
export class FullHouse extends CardCombination {
    constructor(mainCard: string) {
        super(CardCombinationType.FULLHOUSE, 5, getNormalCardValueByName(mainCard));
    }
    /**
     * Attempts to create a `FullHouse` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `FullHouse` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static create(cards: Array<CardInfo>) {
        if (cards.length === 5) {
            let cardOccurences: CardNameOccurencesMap = {};
            for (const card of cards) {
                if (card instanceof PhoenixCard) {
                    if (card.tempName === "") {
                        return null;
                    }
                    if (cardOccurences[card.tempName] === undefined) {
                        cardOccurences[card.tempName] = 0;
                    }
                    cardOccurences[card.tempName]++;
                }
                else if (cardOccurences[card.name] === undefined) {
                    cardOccurences[card.name] = 1;
                }
                else {
                    cardOccurences[card.name]++;
                }
            }
            const distinctCards = Object.keys(cardOccurences);
            if (distinctCards.length === 2) {
                if (cardOccurences[distinctCards[0]] === 3) {
                    return new FullHouse(distinctCards[0]);
                }
                return new FullHouse(distinctCards[1]);
            }
        }
        return null;
    }
    compareCombination(other: FullHouse | null) {
        return CardCombination.basicCompare(this, other);
    }
    compare(cards: Array<CardInfo>, requested: string) {
        return CardCombination.basicCompare(
            this, FullHouse.getStrongestRequested(cards, requested)
        );
    }
    /**
     * Attempts to find the strongest `FullHouse` combination that can be created from
     * the given cards, which includes the requested card.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `FullHouse` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requestedCard: string) {
        if (cards.length >= 5) {
            let phoenixUsed = true;
            let requestedOccurences = 0;
            // Counts occurences of each card
            let cardOccurences: Map<string, number> = new Map();
            for (const card of cards) {
                if (!specialCardNames.includes(card.name)) {
                    let occurences = cardOccurences.get(card.name);
                    if (occurences === undefined) {
                        occurences = 0;
                    }
                    cardOccurences.set(card.name, ++occurences);
                    if (card.name === requestedCard) {
                        requestedOccurences = occurences;
                    }
                }
                else {
                    phoenixUsed = !(card.name === SpecialCards.Phoenix);
                }
            }
            if (requestedOccurences < 1) { return null; }
            if (requestedOccurences < 2) {
                if (!phoenixUsed) {
                    // Using phoenix to replace a second requested card
                    phoenixUsed = true;
                    // Looking for the strongest card with 3 occurences now...
                    requestedOccurences = 2;
                }
                else { return null; }
            }
            else {
                requestedOccurences = Math.min(requestedOccurences, 3);
            }
            return FullHouse.strongestRequestedFullHouse(
                cardOccurences, requestedCard, requestedOccurences, phoenixUsed
            );
        }
        return null;
    }

    static strongestRequestedFullHouse(cardOccurences: Map<string, number>, requestedCard: string,
        requestedOccurences: number, phoenixUsed: boolean) {
        const requestedValue = getNormalCardValueByName(requestedCard);
        if (requestedOccurences === 3) {
            let eligible: string | undefined = undefined;
            for (const [cardName, occurences] of Array.from(cardOccurences)) {
                if (cardName !== requestedCard) {
                    const value = getNormalCardValueByName(cardName);
                    if (occurences >= 3 || (occurences === 2 && !phoenixUsed)) {
                        if (value > requestedValue) {
                            return new FullHouse(cardName);
                        }
                    }
                    else if (occurences === 2 || !phoenixUsed) {
                        eligible = cardName;
                    }
                }
            }
            if (eligible !== undefined) {
                return new FullHouse(requestedCard);
            }
        }
        else {
            for (const [cardName, occurences] of Array.from(cardOccurences)) {
                if (cardName !== requestedCard) {
                    if ((occurences >= 3) || (occurences === 2 && !phoenixUsed)) {
                        const value = getNormalCardValueByName(cardName);
                        if (value < requestedValue && !phoenixUsed) {
                            return new FullHouse(requestedCard);
                        }
                        return new FullHouse(cardName);
                    }
                }
            }
        }
        return null;
    }
}

/**
 * Represents a combination of either 4 same value cards,
 * or 5+ consecutive value cards of the same color.
 * No {@link SpecialCards} may participate.
 */
export class Bomb extends CardCombination {
    color: string;

    constructor(upperCard: string, lowerCard: string, color = '') {
        const topValue = getNormalCardValueByName(upperCard);
        const lower = getNormalCardValueByName(lowerCard);
        const length = topValue - lower + 1;
        super(CardCombinationType.BOMB, length > 1 ? length : 4, topValue);
        this.color = color;
    }

    /**
     * Attempts to create a `Bomb` combination from the given cards.
     * @param cards The given cards. All of them are included in the combination.
     * @returns The `Bomb` combination that is created using the given cards,
     * or `null` if such combination cannot be created.
     */
    static createBomb(cards: Array<CardInfo>) {
        if (cards.length > 4) {
            // Kenta bomb
            let previousCardValue = cards[0].value;
            const color = cards[0].color;
            for (let i = 1; i < cards.length; i++) {
                if (cards[i].value !== previousCardValue - 1 || cards[i].color !== color) {
                    return null;
                }
                previousCardValue--;
            }
            return new Bomb(cards[0].name, cards[cards.length - 1].name, color);
        }
        else if (cards.length === 4) {
            // 4 same cards bomb
            const name = cards[0].name;
            if (cards.slice(1, 4).some(card => card.name !== name)) {
                return null;
            }
            return new Bomb(name, name);
        }
        else {
            // invalid
            return null;
        }
    }

    /** 
     * Compares the given `Bomb` combinations.
     * @returns `0` if they are equal, `> 0` if a > b, else `< 0`.
     */
    static compareBombs(a: Bomb | null, b: Bomb | null) {
        if (a === b) { return 0; }
        if (a === null) { return -1; }
        if (b === null) { return 1; }

        /**
         * Bombs are the only case where different length combinations can be compared
         * (the one with the bigger length is stronger)
         */
        if (a.length !== b.length) {
            return a.length - b.length;
        }
        return a.value - b.value;
    }

    compareCombination(other: Bomb | null) {
        return Bomb.compareBombs(this, other);
    }

    compare(cards: Array<CardInfo>, requested: string) {
        return Bomb.compareBombs(this, Bomb.getStrongestRequested(cards, requested))
    }

    /**
     * Attempts to find the strongest `Bomb` combination that can be created from
     * the given cards, which includes the requested card.
     * 
     * @param cards The given cards.
     * @param requested The name of the requested card to include in the combination.
     * @returns The `Bomb` combination, or `null` if it was not found.
     */
    static getStrongestRequested(cards: Array<CardInfo>, requested: string) {
        let strongestBomb = null;

        let normalCardsColorMap: CardColorOccurencesMap = {};
        for (const key of normalCardKeys) {
            normalCardsColorMap[key] = new Map();
            for (const color of cardColorValues) {
                normalCardsColorMap[key].set(color, false);
            }
        }
        for (const card of cards) {
            if (!specialCardNames.includes(card.name)) {
                normalCardsColorMap[card.name].set(card.color, true);
            }
        }
        const cardColorsArray = Object.entries(normalCardsColorMap);
        const targetIndex = cardColorsArray.findIndex(([name]) => name === requested);
        const [, targetColorMap] = cardColorsArray[targetIndex];
        for (const color of cardColorValues) {
            if (targetColorMap.get(color) === true) {
                let upperIndex = -1, lowerIndex = -1;
                let lengthCounter = 0;
                let colorStrongest = null;

                for (let i = 0; i < cardColorsArray.length; i++) {
                    const [, colors] = cardColorsArray[i];
                    if (colors.get(color) === false) {
                        if (lengthCounter >= 5) {
                            if (targetIndex >= lowerIndex && targetIndex <= upperIndex) {
                                const [upperName] = cardColorsArray[upperIndex];
                                const [lowerName] = cardColorsArray[lowerIndex];
                                let bomb = new Bomb(upperName, lowerName, color);
                                if (Bomb.compareBombs(colorStrongest, bomb) < 0) {
                                    colorStrongest = bomb;
                                }
                            }
                        }
                        lengthCounter = 0;
                    }
                    else {
                        if (lengthCounter === 0) {
                            lowerIndex = i;
                        }
                        upperIndex = i;
                        lengthCounter++;
                    }
                }
                if (lengthCounter >= 5) {
                    if (targetIndex >= lowerIndex && targetIndex <= upperIndex) {
                        const [upperName] = cardColorsArray[upperIndex];
                        const [lowerName] = cardColorsArray[lowerIndex];
                        let bomb = new Bomb(upperName, lowerName, color);
                        if (Bomb.compareBombs(colorStrongest, bomb) < 0) {
                            colorStrongest = bomb;
                        }
                    }
                }
                if (Bomb.compareBombs(strongestBomb, colorStrongest) < 0) {
                    strongestBomb = colorStrongest;
                }
            }
        }
        if (strongestBomb === null) {
            const [, targetColors] = cardColorsArray[targetIndex];
            if (Array.from(targetColors.values()).every(hasColor => hasColor === true)) {
                strongestBomb = new Bomb(requested, requested);
            }
        }
        return strongestBomb;
    }

    /**
     * Attempts to find the strongest `Bomb` combination that can be created from
     * the given cards.
     * 
     * @returns The strongest `Bomb` combination, or `null` if there isn't one.
     */
    static getStrongestBomb(cards: Array<CardInfo>) {
        let strongestBomb = null;

        let groupedNormalCards: CardColorOccurencesMap = {};
        for (const key of normalCardKeys) {
            groupedNormalCards[key] = new Map();
            for (const color of cardColorValues) {
                groupedNormalCards[key].set(color, false);
            }
        }
        for (const card of cards) {
            if (!specialCardNames.includes(card.name)) {
                // not a special card
                groupedNormalCards[card.name].set(card.color, true);
            }
        }
        const cardGroupArray = Object.entries(groupedNormalCards);

        for (const color of cardColorValues) {
            let upperIndex = -1, lowerIndex = -1;
            let lengthCounter = 0;
            let colorStrongest = null;
            for (let i = 0; i < cardGroupArray.length; i++) {
                const [, colors] = cardGroupArray[i];
                if (colors.get(color) === false) {
                    if (lengthCounter >= 5) {
                        const [upperName] = cardGroupArray[upperIndex];
                        const [lowerName] = cardGroupArray[lowerIndex];
                        let bomb = new Bomb(upperName, lowerName, color);
                        if (Bomb.compareBombs(colorStrongest, bomb) < 0) {
                            colorStrongest = bomb;
                        }
                    }
                    lengthCounter = 0;
                }
                else {
                    if (lengthCounter === 0) {
                        lowerIndex = i;
                    }
                    upperIndex = i;
                    lengthCounter++;
                }
            }
            if (lengthCounter >= 5) {
                const [upperName] = cardGroupArray[upperIndex];
                const [lowerName] = cardGroupArray[lowerIndex];
                let bomb = new Bomb(upperName, lowerName, color);
                if (Bomb.compareBombs(colorStrongest, bomb) < 0) {
                    colorStrongest = bomb;
                }
            }
            if (Bomb.compareBombs(strongestBomb, colorStrongest) < 0) {
                strongestBomb = colorStrongest;
            }
        }
        if (strongestBomb === null) {
            for (let i = cardGroupArray.length - 1; i >= 0; i--) {
                const [name, colors] = cardGroupArray[i];
                if (!Array.from(colors.values()).includes(false)) {
                    // we have a bomb
                    let bomb = new Bomb(name, name);
                    // We iterate over the cards starting from the strongest,
                    // so we won't find a stronger bomb
                    strongestBomb = bomb;
                    break;
                }
            }
        }
        return strongestBomb;
    }
}

/**
 * Attempts to create a combination out of the given cards, to be played
 * on top the specified table cards. Note that the created combination
 * may not be stronger than the table one, and therefore will not be played after all.
 * 
 * @returns The created combination, or `null` if it cannot be created.
 */
export function createCombination(cards: Array<CardInfo>, tableCards: Array<CardInfo>) {
    let combination: CardCombination | null = null;
    switch (cards.length) {
        case 1:
            if (cards[0] instanceof PhoenixCard) {
                if (tableCards.length > 0) {
                    if (tableCards[0].name !== SpecialCards.Dragon) {
                        combination = new SingleCard(tableCards[0].value + 0.5);
                    }
                    // The Phoenix cannot be played on top of the Dragon, so the
                    // combination remains null
                }
                else {
                    combination = new SingleCard(1.5);
                }
            }
            else {
                combination = new SingleCard(cards[0].value);
            }
            break;
        case 2:
            combination = CardCouple.create(cards);
            break;
        case 3:
            combination = Triplet.create(cards);
            break;
        default:
            combination = Bomb.createBomb(cards);
            if (combination === null) {
                if (cards.length === 5) {
                    combination = FullHouse.create(cards);
                }
                else if (cards.length % 2 === 0) {
                    combination = Steps.create(cards);
                }
                if (combination !== null) { return combination; }
                combination = Kenta.create(cards);
            }
            break;
    }
    return combination;
}

/**
 * Signals that an unexpected combination type was found (if thrown, this is a bug).
 */
export class UnexpectedCombinationType extends Error {
    constructor(type: any) {
        super(`Unexpected combination type: '${type}'`);
    }
}
