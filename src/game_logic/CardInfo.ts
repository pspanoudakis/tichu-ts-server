import { CardColor, getNormalCardValueByName, NormalCardConfig, SpecialCards, zNormalCardName } from "./CardConfig";
import { BusinessError } from "./BusinessError";
import { UnexpectedCombinationType } from "./CardCombinations";

/**
 * Represents a specific Card, along with its information.
 */
export class CardInfo {
    /** The card 'title' (letter, number or special name). */
    name: string;
    /** The value of the card. */
    value: number;
    /** The value of the card (see {@link CardColor}) */
    color: string | '';
    /**
     * The unique key of the card. This is used by the client to refer
     * e.g. to the selected cards to be played.
     */
    key: string;
    /** Indicates whether the card is currently selected or not. */
    isSelected = false;

    constructor(name: string, color?: typeof CardColor [keyof typeof CardColor]) {
        switch (name) {
            case SpecialCards.Dogs:
                this.key = SpecialCards.Dogs;
                /** By the book, Dogs card has zero value, but this tweak
                 * simplifies the combination logic. */
                this.value = -2;
                break;
            case SpecialCards.Phoenix:
                this.key = SpecialCards.Phoenix;
                this.value = 0.5;
                break;
            case SpecialCards.Mahjong:
                this.key = SpecialCards.Mahjong;
                this.value = 1;
                break;
            case SpecialCards.Dragon:
                this.key = SpecialCards.Dragon;
                this.value = 20;
                break;
            default:
                this.value = getNormalCardValueByName(name);
                if (!color)
                    throw new BusinessError(
                        `Color is required to initialize non-special card.`
                    );
                try {
                    this.key = NormalCardConfig[
                        zNormalCardName.parse(name)
                    ][color].key;
                } catch (err) {
                    throw new UnknownCardNameError(name);
                }
                break;
        }
        this.name = name;
        this.color = color ?? '';
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
                case SpecialCards.Dragon:
                    points += 25;
                    break;
                case SpecialCards.Phoenix:
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
        super(SpecialCards.Phoenix);
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

    override toString() {
        return `Unknown Card Name Error: ${this.message}`;
    }
}
