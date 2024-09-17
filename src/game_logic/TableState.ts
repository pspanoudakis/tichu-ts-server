import { CardCombination } from "./CardCombinations";
import { CardInfo } from "./CardInfo";

export class TableState {
    previousCards: Array<CardInfo> = [];
    currentCards: Array<CardInfo> = [];
    currentCombination: CardCombination | null = null;
    currentCardsOwnerIndex: number = -1;
    requestedCardName: string = '';

    endTableRound() {
        this.previousCards = [];
        this.currentCards = [];
        this.currentCombination = null;
        this.currentCardsOwnerIndex = -1;
    }
}
