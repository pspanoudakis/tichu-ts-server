import { z } from "zod";
import {
    DropBombEvent,
    GiveDragonEvent,
    JoinGameEvent,
    PassTurnEvent,
    PlaceBetEvent,
    PlayCardsEvent,
    ReceiveTradeEvent,
    RequestCardEvent,
    RevealAllCardsEvent,
    TradeCardsEvent
} from "../schemas/events/ClientEvents";
import {
    AllCardsRevealedEvent,
    BetPlacedEvent,
    BombDroppedEvent,
    CardRequestedEvent,
    CardsPlayedEvent,
    CardsTradedEvent,
    DragonGivenEvent,
    GameEndedEvent,
    GameRoundEndedEvent,
    GameRoundStartedEvent,
    PendingDragonDecisionEvent,
    PlayerJoinedEvent,
    PlayerLeftEvent,
    ServerEventType,
    TableRoundEndedEvent,
    TableRoundStartedEvent,
    TurnPassedEvent
} from "../schemas/events/ServerEvents";
import { EventBase } from "../GameSession";
import { BusinessError } from "./BusinessError";
import { UnexpectedCombinationType } from "./CardCombinations";
import { CardInfo } from "./CardInfo";
import { GameRoundState } from "./GameRoundState";
import { PLAYER_KEYS, PlayerKey, TEAM_KEYS, TEAM_PLAYERS, zTeamKeySchema } from "./PlayerKeys";

enum GameStatus {
    INIT = 'INIT',
    IN_PROGRESS = 'IN_PROGRESS',
    OVER = 'OVER'
}

export const zRoundScore = z.object({
    team02: z.number(),
    team13: z.number(),
});
export type RoundScore = z.infer<typeof zRoundScore>;

export const zGameWinnerResult = z.union([
    zTeamKeySchema, z.literal('TIE')
]);
export type GameWinnerResult = z.infer<typeof zGameWinnerResult>;

type PlayerEventEmitter =
    <T extends EventBase>(playerKey: PlayerKey, e: T) => void;
type GlobalEventEmitter =
    <T extends EventBase>(e: T) => void;

export class GameState {
    private _result?: GameWinnerResult;
    private scoreHistory = Array<RoundScore>();
    private team02TotalPoints = 0;
    private team13TotalPoints = 0;
    readonly winningScore: number;
    private status: GameStatus = GameStatus.INIT;
    private _currentRound?: GameRoundState;
    private emitToPlayer: PlayerEventEmitter;
    private emitToAll: GlobalEventEmitter;

    constructor(
        winningScore: number = 1,
        playerEventEmitter: <T extends EventBase>(playerKey: PlayerKey, e: T) => void,
        globalEventEmitter: <T extends EventBase>(e: T) => void
    ) {
        this.winningScore = winningScore;
        this.emitToPlayer = playerEventEmitter;
        this.emitToAll = globalEventEmitter;
    }

    get result() {
        if (!this._result)
            throw new BusinessError('Game Result not decided yet.');
        return this._result;
    }

    private get currentRound() {
        if (!this._currentRound)
            throw new BusinessError('Current Game round not initialized.');
        return this._currentRound;
    }

    get isGameOver() {
        return this.status === GameStatus.OVER;
    }

    private getPlayer(playerKey: PlayerKey) {
        return this.currentRound.players[playerKey];
    }

    private static mapCardsToKeys(cards: CardInfo[]) {
        return cards.map(c => c.key);
    }

    /**
     * Returns `true` if the game must end because the winning score
     * has been reached, `false` otherwise.
     */
    private mustEndGame() {
        return (
            (
                this.winningScore === 0 &&
                this.currentRound.mustEndGameRound()
            ) ||
            this.team02TotalPoints >= this.winningScore ||
            this.team13TotalPoints >= this.winningScore
        );
    }

    private endGameRound() {
        const score = this.currentRound.endGameRoundOrElseThrow();
        this.scoreHistory.push(score);
        this.team02TotalPoints += score.team02;
        this.team13TotalPoints += score.team13;
        if(this.mustEndGame()) {
            if (score.team02 > score.team13) {
                this._result = TEAM_KEYS.TEAM_02;
            } else if (score.team02 < score.team13) {
                this._result = TEAM_KEYS.TEAM_13;
            } else {
                this._result = 'TIE';
            }
            this.status = GameStatus.OVER;
        }
        return score;
    }

    private onGameRoundStarted() {
        this._currentRound = new GameRoundState();
        for (const key of PLAYER_KEYS) {
            const player = this.currentRound.players[key];
            this.emitToPlayer<GameRoundStartedEvent>(key, {
                eventType: ServerEventType.GAME_ROUND_STARTED,
                data: {
                    partialCards:
                        GameState.mapCardsToKeys(player.getRevealedCards())
                },
            });
        }
    }

    private onTableRoundStarted() {
        this.emitToAll<TableRoundStartedEvent>({
            eventType: ServerEventType.TABLE_ROUND_STARTED,
            data: {
                currentPlayer: PLAYER_KEYS[
                    this.currentRound.currentPlayerIndex
                ]
            }
        })
    }

    private onGamePossiblyOver() {
        if (this.isGameOver) {
            this.emitToAll<GameEndedEvent>({
                eventType: ServerEventType.GAME_ENDED,
                data: {
                    result: this.result,
                    team02TotalScore: this.team02TotalPoints,
                    team13TotalScore: this.team13TotalPoints,
                    scores: this.scoreHistory,
                }
            });
        }
    }

    onPlayerJoined(playerKey: PlayerKey, e: JoinGameEvent, startGame = false) {
        if (this.status === GameStatus.IN_PROGRESS)
            throw new BusinessError('Game already started.');
        this.emitToAll<PlayerJoinedEvent>({
            eventType: ServerEventType.PLAYER_JOINED,
            playerKey: playerKey,
            data: {
                playerNickname: e.data.playerNickname,
            }
        });
        if (startGame) {
            this.status = GameStatus.IN_PROGRESS;
            this.onGameRoundStarted();
        }
    }    

    onPlayerLeft(playerKey: PlayerKey, notifyOthers = false) {
        switch (this.status) {
            case GameStatus.INIT:
                break;
            case GameStatus.IN_PROGRESS:
                if (TEAM_PLAYERS['TEAM_02'].includes(playerKey)) {
                    this._result = "TEAM_13";
                } else if (TEAM_PLAYERS['TEAM_13'].includes(playerKey)) {
                    this._result = "TEAM_02";
                } else {
                    throw new Error(
                        `Unexpected player key on disconnected player: ${playerKey}`
                    );
                }
                this.status = GameStatus.OVER;
                break;        
            default:
                throw new Error(
                    `Unexpected game status during client disconnection: ${this.status}`
                );
        }
        if (notifyOthers) {
            this.emitToAll<PlayerLeftEvent>({
                eventType: ServerEventType.PLAYER_LEFT,
                playerKey: playerKey,
            });
            this.onGamePossiblyOver();
        }
    }

    onCardsPlayed(playerKey: PlayerKey, e: PlayCardsEvent) {
        const player = this.getPlayer(playerKey);
        this.currentRound.playCardsOrElseThrow(
            player, e.data.selectedCardKeys
        );
        const combType = 
            this.currentRound.table.currentCombination?.type;
        if (!combType) throw new UnexpectedCombinationType (
            'Unexpected Error: Table combination is null'
        );
        this.emitToAll<CardsPlayedEvent>({
            playerKey: playerKey,
            eventType: ServerEventType.CARDS_PLAYED,
            data: {
                combinationType: combType,
                numCardsRemainingInHand: player.getNumCards(),
                tableCardKeys: GameState.mapCardsToKeys(player.getCards()),
                requestedCardName: 
                    this.currentRound.table.requestedCardName,
            }
        });
        if (this.currentRound.mustEndGameRound()) {
            const score = this.endGameRound();
            this.emitToAll<GameRoundEndedEvent>({
                eventType: ServerEventType.GAME_ROUND_ENDED,
                data: {
                    roundScore: score
                }
            });
            this.onGamePossiblyOver();
            if (!this.isGameOver) {
                this.onGameRoundStarted();
            } 
        }
    }

    onTurnPassed(playerKey: PlayerKey, e: PassTurnEvent) {
        const cardsOwnerIdx =
            this.currentRound.table.currentCardsOwnerIndex;
        this.currentRound
            .passTurnOrElseThrow(this.getPlayer(playerKey));
        this.emitToAll<TurnPassedEvent>({
            playerKey: playerKey,
            eventType: ServerEventType.TURN_PASSED,
        });
        if (this.currentRound.pendingDragonToBeGiven) {
            this.emitToAll<PendingDragonDecisionEvent>({
                eventType: ServerEventType.PENDING_DRAGON_DECISION,
            })
        } else if (!this.currentRound.table.currentCombination) {
            this.emitToAll<TableRoundEndedEvent>({
                eventType: ServerEventType.TABLE_ROUND_ENDED,
                data: {
                    roundWinner: PLAYER_KEYS[cardsOwnerIdx]
                }
            });
            this.onTableRoundStarted();
        }
    }

    onBetPlaced(playerKey: PlayerKey, e: PlaceBetEvent) {
        this.getPlayer(playerKey).placeBetOrElseThrow(e);
        this.emitToAll<BetPlacedEvent>({
            eventType: ServerEventType.BET_PLACED,
            playerKey: playerKey,
            data: {
                betPoints: e.data.betPoints
            }
        });
    }

    onAllCardsRevealed(playerKey: PlayerKey, e: RevealAllCardsEvent) {
        this.getPlayer(playerKey).revealCardsOrElseThrow();
        this.emitToPlayer<AllCardsRevealedEvent>(playerKey, {
            eventType: ServerEventType.ALL_CARDS_REVEALED,
            data: {
                cards: GameState.mapCardsToKeys(
                    this.getPlayer(playerKey).getRevealedCards()
                ),
            }
        });
    }

    onCardsTraded(playerKey: PlayerKey, e: TradeCardsEvent) {
        this.getPlayer(playerKey).finalizeTradesOrElseThrow(e);
        if (PLAYER_KEYS.every(
            k => this.currentRound.players[k].hasSentTrades
        )) {
            this.currentRound.makeCardTrades();
            for (const key of PLAYER_KEYS) {
                const player = this.currentRound.players[key];
                this.emitToPlayer<CardsTradedEvent>(key, {
                    eventType: ServerEventType.CARDS_TRADED,
                    data: {
                        cardByTeammate: player.incomingTrades.teammate.key,
                        cardByLeft: player.incomingTrades.left.key,
                        cardByRight: player.incomingTrades.right.key,
                    },
                })
            }
        }
    }

    onTradeReceived(playerKey: PlayerKey, e: ReceiveTradeEvent) {
        this.getPlayer(playerKey).receiveTradesOrElseThrow();
        if (PLAYER_KEYS.every(
            k => this.currentRound.players[k].hasReceivedTrades
        )) {
            this.onTableRoundStarted();
        }
    }

    onBombDropped(playerKey: PlayerKey, e: DropBombEvent) {
        this.currentRound.enablePendingBombOrElseThrow(this.getPlayer(playerKey));
        this.emitToAll<BombDroppedEvent>({
            playerKey: playerKey,
            eventType: ServerEventType.BOMB_DROPPED,
        });
    }
    
    onCardRequested(playerKey: PlayerKey, e: RequestCardEvent) {
        this.currentRound.setRequestedCardOrElseThrow(this.getPlayer(playerKey), e);
        this.emitToAll<CardRequestedEvent>({
            playerKey: playerKey,
            eventType: ServerEventType.CARD_REQUESTED,
            data: {
                requestedCardName: e.data.requestedCardName
            },
        });
    }
    
    onDragonGiven(playerKey: PlayerKey, e: GiveDragonEvent) {
        this.currentRound.giveDragonOrElseThrow(this.getPlayer(playerKey), e);
        this.emitToAll<DragonGivenEvent>({
            playerKey: playerKey,
            eventType: ServerEventType.DRAGON_GIVEN,
            data: {
                dragonReceiverKey: e.data.chosenOponentKey
            },
        });
    }
}
