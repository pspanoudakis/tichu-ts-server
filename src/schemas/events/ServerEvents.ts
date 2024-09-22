import { z } from "zod";
import {
    createEmptyGameEventSchema,
    createGameEventSchema,
    GameEvent,
    zCardKey, 
    zCardName
} from "./GameEvent";
import { GameBet } from "../../game_logic/GameRoundState";
import { CardCombinationType } from "../../game_logic/CardCombinations";
import { zGameWinnerResult, zRoundScore } from "../../game_logic/GameState";
import { PlayerKey, zPlayerKey } from "../../game_logic/PlayerKeys";

export const ServerEventType = {
    WAITING_4_JOIN: 'WAITING_4_JOIN',
    ROOM_CREATED: 'ROOM_CREATED',
    PLAYER_JOINED: 'PLAYER_JOINED',
    PLAYER_LEFT: 'PLAYER_LEFT',
    ALL_CARDS_REVEALED: 'ALL_CARDS_REVEALED',
    CARDS_PLAYED: 'CARDS_PLAYED',
    TURN_PASSED: 'TURN_PASSED',
    CARDS_TRADED: 'CARDS_TRADED',
    PENDING_DRAGON_DECISION: 'PENDING_DRAGON_DECISION',
    DRAGON_GIVEN: 'DRAGON_GIVEN',
    BET_PLACED: 'BET_PLACED',
    BOMB_DROPPED: 'BOMB_DROPPED',
    CARD_REQUESTED: 'CARD_REQUESTED',
    MESSAGE_SENT: 'MESSAGE_SENT',
    TABLE_ROUND_STARTED: 'TABLE_ROUND_STARTED',
    TABLE_ROUND_ENDED: 'TABLE_ROUND_ENDED',
    GAME_ROUND_STARTED: 'GAME_ROUND_STARTED',
    GAME_ROUND_ENDED: 'GAME_ROUND_ENDED',
    GAME_ENDED: 'GAME_ENDED',
    BUSINESS_ERROR: 'BUSINESS_ERROR',
    UNKNOWN_SERVER_ERROR: 'UNKNOWN_SERVER_ERROR',
    CLIENT_STATE_SYNC: 'CLIENT_STATE_SYNC',
} as const;

export type WaitingForJoinEvent = GameEvent<
    typeof ServerEventType.WAITING_4_JOIN, {
        presentPlayers: {
            [playerKey in PlayerKey]?: string
        },
        winningScore: number
    }    
>;

export const zPlayerJoinedEvent = createGameEventSchema(
    z.literal(ServerEventType.PLAYER_JOINED),
    z.object({
        playerNickname: z.string(),
    })
)
export type PlayerJoinedEvent = z.infer<typeof zPlayerJoinedEvent>;

export const zPlayerLeftEvent = createEmptyGameEventSchema(
    z.literal(ServerEventType.PLAYER_LEFT)
);
export type PlayerLeftEvent = z.infer<typeof zPlayerLeftEvent>;

export const zAllCardsRevealedEvent = createGameEventSchema(
    z.literal(ServerEventType.ALL_CARDS_REVEALED),
    z.object({
        cards: z.array(zCardKey),
    })
);
export type AllCardsRevealedEvent = z.infer<typeof zAllCardsRevealedEvent>;

export const zCardsPlayedEvent = createGameEventSchema(
    z.literal(ServerEventType.CARDS_PLAYED),
    z.object({
        numCardsRemainingInHand: z.number(),
        combinationType: z.nativeEnum(CardCombinationType),
        tableCardKeys: z.array(zCardKey),
        requestedCardName: z.optional(z.string()),
    })
);
export type CardsPlayedEvent = z.infer<typeof zCardsPlayedEvent>;

export const zTurnPassedEvent = createEmptyGameEventSchema(
    z.literal(ServerEventType.TURN_PASSED)
);
export type TurnPassedEvent = z.infer<typeof zTurnPassedEvent>;

export const zCardsTradedEvent = createGameEventSchema(
    z.literal(ServerEventType.CARDS_TRADED),
    z.object({
        cardByTeammate: zCardKey,
        cardByLeft: zCardKey,
        cardByRight: zCardKey,
    })
);
export type CardsTradedEvent = z.infer<typeof zCardsTradedEvent>;

export const zPendingDragonDecisionEvent = createEmptyGameEventSchema(
    z.literal(ServerEventType.PENDING_DRAGON_DECISION)
);
export type PendingDragonDecisionEvent =
    z.infer<typeof zPendingDragonDecisionEvent>;

export const zDragonGivenEvent = createGameEventSchema(
    z.literal(ServerEventType.DRAGON_GIVEN),
    z.object({
        dragonReceiverKey: zPlayerKey,
    })
);
export type DragonGivenEvent = z.infer<typeof zDragonGivenEvent>;

export const zBetPlacedEvent = createGameEventSchema(
    z.literal(ServerEventType.BET_PLACED),
    z.object({
        betPoints: z.union([
            z.literal(GameBet.TICHU),
            z.literal(GameBet.GRAND_TICHU)
        ]),
    })
)
export type BetPlacedEvent = z.infer<typeof zBetPlacedEvent>;

export const zBombDroppedEvent = createEmptyGameEventSchema(
    z.literal(ServerEventType.BOMB_DROPPED)
);
export type BombDroppedEvent = z.infer<typeof zBombDroppedEvent>;

export const zCardRequestedEvent = createGameEventSchema(
    z.literal(ServerEventType.CARD_REQUESTED),
    z.object({
        requestedCardName: zCardName,
    })
)
export type CardRequestedEvent = z.infer<typeof zCardRequestedEvent>;

export const zMessageSentEvent = createGameEventSchema(
    z.literal(ServerEventType.MESSAGE_SENT),
    z.object({
        sentBy: z.string(),
        sentOn: z.string(),
        text: z.string(),
    })
);
export type MessageSentEvent = z.infer<typeof zMessageSentEvent>;

export const zTableRoundStartedEvent = createGameEventSchema(
    z.literal(ServerEventType.TABLE_ROUND_STARTED),
    z.object({
        currentPlayer: zPlayerKey,
    })
);
export type TableRoundStartedEvent = z.infer<typeof zTableRoundStartedEvent>;

export const zTableRoundEndedEvent = createGameEventSchema(
    z.literal(ServerEventType.TABLE_ROUND_ENDED),
    z.object({
        roundWinner: zPlayerKey,
    })
);
export type TableRoundEndedEvent = z.infer<typeof zTableRoundEndedEvent>;

export const zGameRoundStartedEvent = createGameEventSchema(
    z.literal(ServerEventType.GAME_ROUND_STARTED),
    z.object({
        partialCards: z.array(zCardKey),
    })
);
export type GameRoundStartedEvent = z.infer<typeof zGameRoundStartedEvent>;

export const zGameRoundEndedEvent = createGameEventSchema(
    z.literal(ServerEventType.GAME_ROUND_ENDED),
    z.object({
        roundScore: zRoundScore,
    })
);
export type GameRoundEndedEvent = z.infer<typeof zGameRoundEndedEvent>;

export const zGameEndedEvent = createGameEventSchema(
    z.literal(ServerEventType.GAME_ENDED),
    z.object({
        result: zGameWinnerResult,
        team02TotalScore: z.number(),
        team13TotalScore: z.number(),
        scores: z.array(zRoundScore),
    })
);
export type GameEndedEvent = z.infer<typeof zGameEndedEvent>;

export const zErrorEvent = createGameEventSchema(
    z.union([
        z.literal(ServerEventType.BUSINESS_ERROR),
        z.literal(ServerEventType.UNKNOWN_SERVER_ERROR)
    ]),
    z.object({
        message: z.string(),
    })
);
export type ErrorEvent = z.infer<typeof zErrorEvent>;

export const zClientStateSyncEvent = createGameEventSchema(
    z.literal(ServerEventType.CLIENT_STATE_SYNC),
    z.object({

    })
);
export type ClientStateSyncEvent = z.infer<typeof zClientStateSyncEvent>;