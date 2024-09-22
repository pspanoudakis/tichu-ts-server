import { PlaceBetEvent, TradeCardsEvent } from "../events/ClientEvents";
import { BusinessError } from "./BusinessError";
import { CardInfo, specialCards } from "./CardInfo";
import { GameBet } from "./GameRoundState";
import { PlayerKey } from "./PlayerKeys";

type PlayerTradeDecisions = {
    teammate: CardInfo,
    left: CardInfo,
    right: CardInfo,
};

export class PlayerState {
    readonly playerKey: PlayerKey;
    private _cards = new Map<string, CardInfo>();
    private _heap = Array<CardInfo>();
    private _bet = GameBet.NONE;
    private _tradesOut?: PlayerTradeDecisions;
    private _tradesIn?: PlayerTradeDecisions;
    private _hasPlacedBet = false;
    private _hasRevealedCards = false;
    private _hasSentTrades = false;
    private _hasReceivedTrades = false;

    constructor(playerKey: PlayerKey) {
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
    get tradeDecisions(): Readonly<PlayerTradeDecisions>{
        if (!this._tradesOut)
            throw new BusinessError(
                'This player has not finalized trade decisions.'
            );
        return this._tradesOut;
    }
    get incomingTrades(): Readonly<PlayerTradeDecisions>{
        if (!this._tradesIn)
            throw new BusinessError(
                'Incoming trades for this player have not been stored.'
            );
        return this._tradesIn;
    }
    set incomingTrades(t: PlayerTradeDecisions){
        if (!this._hasSentTrades)
            throw new BusinessError(
                'Trade decisions must be finalized before receiving incoming trades.'
            );
        if (this._tradesIn)
            throw new BusinessError(
                'Incoming trades for this player have already been set.'
            );
        this._tradesIn = {
            left: t.left,
            right: t.right,
            teammate: t.teammate
        };
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
        return this._hasRevealedCards ? this.getCards() : this.getCards().slice(0, 8);
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
        if (!this._cards.size) {
            throw new BusinessError('Cards have not been handed to this player yet.');
        }
        if (this._hasRevealedCards)
            throw new BusinessError('Cards have already been revealed.');
        this._hasRevealedCards = true;            
    }
    
    finalizeTradesOrElseThrow(e: TradeCardsEvent) {
        if (this._hasSentTrades)
            throw new BusinessError('This player has already finalized cards for trade.');
        if (!this._hasRevealedCards)
            throw new BusinessError('Cannot finalize trades before revealing cards.');
        this._tradesOut = {
            teammate: this.findCardByKeyOrElseThrow(e.data.teammateCardKey),
            left: this.findCardByKeyOrElseThrow(e.data.leftCardKey),
            right: this.findCardByKeyOrElseThrow(e.data.rightCardKey),
        };
        this._cards.delete(this._tradesOut.left.key);
        this._cards.delete(this._tradesOut.right.key);
        this._cards.delete(this._tradesOut.teammate.key);
        this._hasSentTrades = true;
    }

    receiveTradesOrElseThrow() {
        if (!this._tradesIn)
            throw new BusinessError('No incoming trades to receive have been stored.');
        if (this._hasReceivedTrades)
            throw new BusinessError('Trades have already been received by this player');
        this._cards.set(this._tradesIn.left.key, this._tradesIn.left);
        this._cards.set(this._tradesIn.right.key, this._tradesIn.right);
        this._cards.set(this._tradesIn.teammate.key, this._tradesIn.teammate);
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
