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

export type CreateRoomEvent = GameEvent<
    ClientEventType.CREATE_ROOM, {
        winningScore: number,
        playerNickname: string,
    }
>;

export type JoinGameEvent = GameEvent<
    ClientEventType.JOIN_GAME, {
        playerNickname: string,
    }
>;

export type PlayCardsEvent = GameEvent<
    ClientEventType.PLAY_CARDS, {
        selectedCardKeys: CardKey[],
    }
>;

export type PassTurnEvent = GameEvent<ClientEventType.PASS_TURN>;

export type TradeCardsEvent = GameEvent<
    ClientEventType.TRADE_CARDS, {
        teammateCardKey: CardKey,
        leftCardKey: CardKey,
        rightCardKey: CardKey,
    }
>;

export type ReceiveTradeEvent = GameEvent<ClientEventType.RECEIVE_TRADE>;

export type GiveDragonEvent = GameEvent<
    ClientEventType.GIVE_DRAGON, {
        chosenOponentKey: PlayerKey,
    }
>;

export type PlaceBetEvent = GameEvent<
    ClientEventType.PLACE_BET, {
        betPoints: GameBet.TICHU | GameBet.GRAND_TICHU
    }
>;

export type DropBombEvent = GameEvent<ClientEventType.DROP_BOMB>;

export type RequestCardEvent = GameEvent<
    ClientEventType.REQUEST_CARD, {
        requestedCardName: CardName
    }
>;

export type SendMessageEvent = GameEvent<
    ClientEventType.SEND_MESSAGE, {
        message: string
    }
>;
