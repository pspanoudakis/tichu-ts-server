import { CardCombination } from "./CardCombinations";
import { CardInfo } from "./CardInfo";

export class TableState {
    previousCards: Array<CardInfo> = [];
    currentCards: Array<CardInfo> = [];
    currentCombination: CardCombination | null = null;
    currentCardsOwnerIndex: number = -1;
    requestedCardName: string;

    constructor(requestedCardName = '') {
        this.requestedCardName = requestedCardName;
    }
}
