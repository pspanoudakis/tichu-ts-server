import { CardKey, CardName, GameEvent } from "./GameEvent";
import { GameBet } from "../game_logic/GameRoundState";
import { CardCombinationType } from "../game_logic/CardCombinations";
import { GameWinnerResult } from "../game_logic/GameWinnerResult";
import { PlayerKey, RoundScore } from "../game_logic/GameState";

export enum ServerEventType {
    WAITING_4_JOIN = 'WAITING_4_JOIN',
    ROOM_CREATED = 'ROOM_CREATED',
    PLAYER_JOINED = 'PLAYER_JOINED',
    PLAYER_LEFT = 'PLAYER_LEFT',
    ALL_CARDS_REVEALED = 'ALL_CARDS_REVEALED',
    CARDS_PLAYED = 'CARDS_PLAYED',
    TURN_PASSED = 'TURN_PASSED',
    CARDS_TRADED = 'CARDS_TRADED',
    PENDING_DRAGON_DECISION ='PENDING_DRAGON_DECISION',
    DRAGON_GIVEN = 'DRAGON_GIVEN',
    BET_PLACED = 'BET_PLACED',
    BOMB_DROPPED = 'BOMB_DROPPED',
    CARD_REQUESTED = 'CARD_REQUESTED',
    MESSAGE_SENT = 'MESSAGE_SENT',
    TABLE_ROUND_STARTED = 'TABLE_ROUND_STARTED',
    TABLE_ROUND_ENDED = 'TABLE_ROUND_ENDED',
    GAME_ROUND_STARTED = 'GAME_ROUND_STARTED',
    GAME_ROUND_ENDED = 'GAME_ROUND_ENDED',
    GAME_ENDED = 'GAME_ENDED',
    BUSINESS_ERROR = 'BUSINESS_ERROR',
    UNKNOWN_SERVER_ERROR = 'UNKNOWN_SERVER_ERROR',
    CLIENT_STATE_SYNC = 'CLIENT_STATE_SYNC',
};

export type WaitingForJoinEvent = GameEvent<
    ServerEventType.WAITING_4_JOIN, {
        presentPlayers: {
            [playerKey in PlayerKey]?: string
        },
        winningScore: number
    }    
>;

export type PlayerJoinedEvent = GameEvent<
    ServerEventType.PLAYER_JOINED,
    {
        playerNickname: string
    }
>;

export type PlayerLeftEvent = GameEvent<ServerEventType.PLAYER_LEFT>

export type AllCardsRevealedEvent = GameEvent<
    ServerEventType.ALL_CARDS_REVEALED, {
        cards: CardKey[],
    }
>;

export type CardsPlayedEvent = GameEvent<
    ServerEventType.CARDS_PLAYED, {
        numCardsRemainingInHand: number,
        combinationType: CardCombinationType,
        tableCardKeys: CardKey[],
        requestedCardName?: string,
    }
>;

export type TurnPassedEvent = GameEvent<ServerEventType.TURN_PASSED>;

export type CardsTradedEvent = GameEvent<
    ServerEventType.CARDS_TRADED, {
        cardByTeammate: CardKey,
        cardByLeft: CardKey,
        cardByRight: CardKey,
    }
>;

export type PendingDragonDecisionEvent = GameEvent<
    ServerEventType.PENDING_DRAGON_DECISION
>;

export type DragonGivenEvent = GameEvent<
    ServerEventType.DRAGON_GIVEN, {
        dragonReceiverKey: PlayerKey,
    }
>;

export type BetPlacedEvent = GameEvent<
    ServerEventType.BET_PLACED, {
        betPoints: GameBet.TICHU | GameBet.GRAND_TICHU,
    }
>;

export type BombDroppedEvent = GameEvent<ServerEventType.BOMB_DROPPED>;

export type CardRequestedEvent = GameEvent<
    ServerEventType.CARD_REQUESTED, {
        requestedCardName: CardName,
    }
>;

export type MessageSentEvent = GameEvent<
    ServerEventType.MESSAGE_SENT, {
        message: string,
    }
>;

export type TableRoundStartedEvent = GameEvent<
    ServerEventType.TABLE_ROUND_STARTED, {
        currentPlayer: PlayerKey,
    }
>;

export type TableRoundEndedEvent = GameEvent<
    ServerEventType.TABLE_ROUND_ENDED, {
        roundWinner: PlayerKey
    }
>;

export type GameRoundStartedEvent = GameEvent<
    ServerEventType.GAME_ROUND_STARTED, {
        partialCards: CardKey[],
    }
>;

export type GameRoundEndedEvent = GameEvent<
    ServerEventType.GAME_ROUND_ENDED, {
        roundScore: RoundScore,
    }
>;

export type GameEndedEvent = GameEvent<
    ServerEventType.GAME_ENDED, {
        result: GameWinnerResult,
        team02TotalScore: number,
        team13TotalScore: number,
        scores: RoundScore[],
    }
>;

export type ErrorEvent = GameEvent<
    ServerEventType.BUSINESS_ERROR | ServerEventType.UNKNOWN_SERVER_ERROR, {
        message: string
    }
>;

export type ClientStateSyncEvent = GameEvent<
    ServerEventType.CLIENT_STATE_SYNC, {
        
    }
>;
