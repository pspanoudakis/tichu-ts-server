import { GameBet } from "../game_logic/GameboardState";
import { PlayerKey } from "../game_logic/GameState";
import { CardKey, CardName, GameEvent } from "./GameEvent";

export enum ClientEventType {
    CREATE_ROOM = 'CREATE_ROOM',
    JOIN_GAME = 'JOIN_GAME',
    PLAY_CARDS = 'PLAY_CARDS',
    PASS_TURN = 'PASS_TURN',
    TRADE_CARDS = 'TRADE_CARDS',
    RECEIVE_TRADE = 'RECEIVE_TRADE',
    GIVE_DRAGON = 'GIVE_DRAGON',
    REVEAL_ALL_CARDS = 'REVEAL_ALL_CARDS',
    PLACE_BET = 'PLACE_BET',
    DROP_BOMB = 'DROP_BOMB',
    REQUEST_CARD = 'REQUEST_CARD',
    SEND_MESSAGE = 'SEND_MESSAGE',
};

type SessionClientEvent<T, D = undefined> = GameEvent<
    T, D & {
        sessionId: string,
    }
>

export type CreateRoomEvent = GameEvent<
    ClientEventType.CREATE_ROOM, {
        winningScore: number,
        playerNickname: string,
    }
>;

export type JoinGameEvent = SessionClientEvent<
    ClientEventType.JOIN_GAME, {
        playerNickname: string,
    }
>;

export type PlayCardsEvent = SessionClientEvent<
    ClientEventType.PLAY_CARDS, {
        selectedCardKeys: CardKey[],
    }
>;

export type PassTurnEvent = SessionClientEvent<ClientEventType.PASS_TURN>;

export type TradeCardsEvent = GameEvent<
    ClientEventType.TRADE_CARDS, {
        teammateCardKey: CardKey,
        leftCardKey: CardKey,
        rightCardKey: CardKey,
    }
>;

export type ReceiveTradeEvent = SessionClientEvent<ClientEventType.RECEIVE_TRADE>;

export type GiveDragonEvent = SessionClientEvent<
    ClientEventType.GIVE_DRAGON, {
        chosenOponentKey: PlayerKey,
    }
>;

export type PlaceBetEvent = SessionClientEvent<
    ClientEventType.PLACE_BET, {
        betPoints: GameBet.TICHU | GameBet.GRAND_TICHU
    }
>;

export type DropBombEvent = SessionClientEvent<ClientEventType.DROP_BOMB>;

export type RequestCardEvent = SessionClientEvent<
    ClientEventType.REQUEST_CARD, {
        requestedCardName: CardName
    }
>;

export type SendMessageEvent = SessionClientEvent<
    ClientEventType.SEND_MESSAGE, {
        message: string
    }
>;