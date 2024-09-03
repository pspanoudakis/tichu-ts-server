import { GameBet } from "../game_logic/GameboardState";

export enum ServerEventType {
    CARDS_PLAYED = 'CARDS_PLAYED',
    TURN_PASSED = 'TURN_PASSED',
    CARDS_TRADED = 'CARDS_TRADED',
    DRAGON_GIVEN = 'DRAGON_GIVEN',
    BET_PLACED = 'BET_PLACED',
    BOMB_DROPPED = 'BOMB_DROPPED',
    CARD_REQUESTED = 'CARD_REQUESTED',
    MESSAGE_SENT = 'MESSAGE_SENT',
    TABLE_ROUND_ENDED = 'TABLE_ROUND_ENDED',
    GAME_ROUND_STARTED = 'GAME_ROUND_STARTED',
    GAME_ROUND_ENDED = 'GAME_ROUND_ENDED',
    GAME_ENDED = 'GAME_ENDED',
};

export type CardsPlayedEvent  = GameEvent<
    ServerEventType.CARDS_PLAYED, {
        combinationType: string,
        tableCardKeys: string[],
    }
>;

export type TurnPassedEvent  = GameEvent<ServerEventType.TURN_PASSED, undefined>;

export type CardsTradedEvent  = GameEvent<
    ServerEventType.CARDS_TRADED, {

    }
>;

export type DragonGivenEvent  = GameEvent<
    ServerEventType.DRAGON_GIVEN, {
        dragonReceiverKey: string,
    }
>;

export type BetPlacedEvent  = GameEvent<
    ServerEventType.BET_PLACED, {
        betPoints: GameBet.TICHU | GameBet.GRAND_TICHU
    }
>;

export type BombDroppedEvent  = GameEvent<ServerEventType.BOMB_DROPPED, undefined>;

export type CardRequestedEvent  = GameEvent<
    ServerEventType.CARD_REQUESTED, {
        requestedCardKey: string
    }
>;

export type MessageSentEvent  = GameEvent<
    ServerEventType.MESSAGE_SENT, {
        message: string,
    }
>;

export type TableRoundEndedEvent  = GameEvent<
    ServerEventType.TABLE_ROUND_ENDED, {
        
    }
>;

export type GameRoundStartedEvent  = GameEvent<
    ServerEventType.GAME_ROUND_STARTED, {
        
    }
>;

export type GameRoundEndedEvent  = GameEvent<
    ServerEventType.GAME_ROUND_ENDED, {
        
    }
>;

export type GameEvent  = GameEvent<
    ServerEventType.GAME_ENDED, {
        
    }
>;

