import { PlaceBetEvent, TradeCardsEvent } from "../events/ClientEvents";
import { BusinessError } from "../responses/BusinessError";
import { CardInfo } from "./CardInfo";
import { GameBet } from "./GameRoundState";

type PlayerTradeDecision = {
    toTeammate: CardInfo,
    toLeft: CardInfo,
    toRight: CardInfo,
}

export class PlayerState {
    readonly playerKey: string;
    private _cards = new Map<string, CardInfo>();
    private _heap = Array<CardInfo>();
    private _bet = GameBet.NONE;
    private _trades?: PlayerTradeDecision;
    private _hasPlacedBet = false;
    private _hasRevealedCards = false;
    private _hasSentTrades = false;
    private _hasReceivedTrades = false;

    constructor(playerKey: string) {
        this.playerKey = playerKey;
    }
    
    get bet() : GameBet {
        return this._bet;
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

    private findCardByKeyOrElseThrow(key: string) {
        const card = this._cards.get(key);
        if (!card) throw new BusinessError(
            `This player does not own a card with key ${key}`
        );
        return card;
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

    revealCards() {
        if (this._hasRevealedCards)
            throw new BusinessError('Cards have already been revealed.');
        this._hasRevealedCards = true;            
    }
    
    sendTradesOrElseThrow(e: TradeCardsEvent) {
        if (this._hasSentTrades)
            throw new BusinessError('This player has already send cards for trade.');
        if (!this._hasRevealedCards) {
            throw new BusinessError('Cannot perform trades before revealing cards.');
        }
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

    receiveTrades(cardByTeammate: CardInfo, cardByLeft: CardInfo, cardByRight: CardInfo) {
        if (this._hasReceivedTrades)
            throw new BusinessError('Trades have already been received by this player');
        this._cards.set(cardByTeammate.key, cardByTeammate);
        this._cards.set(cardByLeft.key, cardByLeft);
        this._cards.set(cardByRight.key, cardByRight);
        this._hasReceivedTrades = true;
    }
}
