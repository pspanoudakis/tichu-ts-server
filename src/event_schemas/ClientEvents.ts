import { GameBet } from "../game_logic/GameboardState";
import { GameEvent } from "./GameEvent";

export enum ClientEventType {
    PLAY_CARDS = 'PLAY_CARDS',
    PASS_TURN = 'PASS_TURN',
    TRADE_CARDS = 'TRADE_CARDS',
    RECEIVE_TRADE = 'RECEIVE_TRADE',
    GIVE_DRAGON = 'GIVE_DRAGON',
    PLACE_BET = 'PLACE_BET',
    DROP_BOMB = 'DROP_BOMB',
    REQUEST_CARD = 'REQUEST_CARD',
    SEND_MESSAGE = 'SEND_MESSAGE',
};

export type PlayCardsEvent = GameEvent<
    ClientEventType.PLAY_CARDS, {
        selectedCardKeys: string[],
    }
>;

export type PassTurnEvent = GameEvent<ClientEventType.PASS_TURN, undefined>;

export type TradeCardsEvent = GameEvent<
    ClientEventType.TRADE_CARDS, {
        teammateCardKey: string,
        leftCardKey: string,
        rightCardKey: string,
    }
>;

export type ReceiveTradeEvent = GameEvent<ClientEventType.RECEIVE_TRADE, undefined>;

export type GiveDragonEvent = GameEvent<
    ClientEventType.GIVE_DRAGON, {
        chosenOponentKey: string,
    }
>;

export type PlaceBetEvent = GameEvent<
    ClientEventType.PLACE_BET, {
        betPoints: GameBet.TICHU | GameBet.GRAND_TICHU
    }
>

export type DropBombEvent = GameEvent<ClientEventType.DROP_BOMB, undefined>;

export type RequestCardEvent = GameEvent<
    ClientEventType.REQUEST_CARD, {
        requestedCardName: string
    }
>;

export type SendMessageEvent = GameEvent<
    ClientEventType.SEND_MESSAGE, {
        message: string
    }
>;
