import { PlaceBetEvent, TradeCardsEvent } from "../events/ClientEvents";
import { BusinessError } from "../responses/BusinessError";
import { CardInfo, specialCards } from "./CardInfo";
import { GameBet } from "./GameRoundState";

export type PlayerTradeDecisions = {
    toTeammate: CardInfo,
    toLeft: CardInfo,
    toRight: CardInfo,
};

export class PlayerState {
    readonly playerKey: string;
    private _cards = new Map<string, CardInfo>();
    private _heap = Array<CardInfo>();
    private _bet = GameBet.NONE;
    private _trades?: PlayerTradeDecisions;
    private _hasPlacedBet = false;
    private _hasRevealedCards = false;
    private _hasSentTrades = false;
    private _hasReceivedTrades = false;

    constructor(playerKey: string) {
        this.playerKey = playerKey;
    }

    getCards() {
        return Array.from(this._cards.values());
    }
    getNumCards() {
        return this._cards.size;
    }
    get heap() : readonly CardInfo[] {
        return this._heap;
    }    
    get bet() {
        return this._bet;
    }
    get trades(): Readonly<PlayerTradeDecisions>{
        if (!this._trades)
            throw new BusinessError('This player has not finalized trade decisions.');
        return this._trades;
    }
    get hasPlacedBet() {
        return this._hasPlacedBet;
    }
    get hasRevealedCards() {
        return this._hasRevealedCards;
    }
    get hasReceivedTrades() {
        return this._hasReceivedTrades;
    }
    get hasSentTrades() {
        return this._hasSentTrades;
    }

    private findCard(predicate: (c: CardInfo) => any) {
        for (const card of this._cards.values())
            if (predicate(card)) return card;
    }

    private findCardByKeyOrElseThrow(key: string) {
        const card = this._cards.get(key);
        if (!card) throw new BusinessError(
            `This player does not own a card with key ${key}`
        );
        return card;
    }

    handCards(cards: CardInfo[]) {
        if (this._cards.size !== 0 || this._hasRevealedCards)
            throw new BusinessError('This player has already been handed cards.');
        cards.forEach(c => this._cards.set(c.key, c));
    }

    getRevealedCards() {
        return this._hasRevealedCards ? this.getCards() : this.getCards().slice(0, 9);
    }

    placeBetOrElseThrow(e: PlaceBetEvent) {
        if (this._hasPlacedBet)
            throw new BusinessError('This player has already placed a bet.');
        if ((e.data.betPoints === GameBet.GRAND_TICHU) && this.hasRevealedCards)
            throw new BusinessError(
                'A Grand Tichu bet cannot be placed since all cards have been revealed.'
            );
        if (this._cards.size < 14)
            throw new BusinessError(
                'A bet cannot be placed since this player has used some of the given cards.'
            );
        this._bet = e.data.betPoints;
        this._hasPlacedBet = true;
    }

    revealCardsOrElseThrow() {
        if (this._hasRevealedCards)
            throw new BusinessError('Cards have already been revealed.');
        this._hasRevealedCards = true;            
    }
    
    sendTradesOrElseThrow(e: TradeCardsEvent) {
        if (this._hasSentTrades)
            throw new BusinessError('This player has already send cards for trade.');
        if (!this._hasRevealedCards)
            throw new BusinessError('Cannot perform trades before revealing cards.');
        this._trades = {
            toTeammate: this.findCardByKeyOrElseThrow(e.data.teammateCardKey),
            toLeft: this.findCardByKeyOrElseThrow(e.data.leftCardKey),
            toRight: this.findCardByKeyOrElseThrow(e.data.rightCardKey),
        };
        this._cards.delete(this._trades.toLeft.key);
        this._cards.delete(this._trades.toRight.key);
        this._cards.delete(this._trades.toTeammate.key);
        this._hasSentTrades = true;
    }

    receiveTradesOrElseThrow(cardByTeammate: CardInfo, cardByLeft: CardInfo, cardByRight: CardInfo) {
        if (this._hasReceivedTrades)
            throw new BusinessError('Trades have already been received by this player');
        this._cards.set(cardByTeammate.key, cardByTeammate);
        this._cards.set(cardByLeft.key, cardByLeft);
        this._cards.set(cardByRight.key, cardByRight);
        this._hasReceivedTrades = true;
    }

    hasMahjong() {
        return Boolean(this.findCard(c => c.name === specialCards.MAHJONG));
    }

    getCardsByKeys(cardKeys: string[]) {
        return cardKeys.map(k => this.findCardByKeyOrElseThrow(k));
    }

    removeCards(cards: CardInfo[]) {
        cards.forEach(c => this.findCardByKeyOrElseThrow(c.key));
        cards.forEach(c => this._cards.delete(c.key));
    }

    addCardsToHeap(...cards: CardInfo[]) {
        this._heap.push(...cards);
    }
}
