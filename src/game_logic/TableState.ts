import { CardCombination } from "./CardCombinations";
import { CardInfo } from "./CardInfo";

export class TableState {
    private _previousCards: Array<CardInfo> = [];
    private _currentCards: Array<CardInfo> = [];
    private _currentCombination: CardCombination | null = null;
    private _currentCardsOwnerIndex: number = -1;

    get currentCombination() {
        return this._currentCombination;
    }

    get previousCards(): readonly CardInfo[] {
        return this._previousCards;
    }
    
    get currentCards(): readonly CardInfo[] {
        return this._currentCards;
    }

    get currentCardsOwnerIndex() {
        return this._currentCardsOwnerIndex;
    }

    onCardsPlayed(
        newCards: readonly CardInfo[],
        newCombination: CardCombination,
        newOwnerIdx: number
    ) {
        this._previousCards.push(...this._currentCards)
        this._currentCards = Array.from(newCards).sort(CardInfo.compareCards);
        this._currentCombination = newCombination;
        this._currentCardsOwnerIndex = newOwnerIdx;
    }

    endTableRound() {
        const cardsForHeap = [
            ...this._currentCards,
            ...this._previousCards
        ]
        this._previousCards = [];
        this._currentCards = [];
        this._currentCardsOwnerIndex = -1;
        this._currentCombination = null;
        return cardsForHeap;
    }
}
