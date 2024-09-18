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
} from "../events/ClientEvents";
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
} from "../events/ServerEvents";
import { EventBase } from "../GameSession";
import { BusinessError } from "../responses/BusinessError";
import { UnexpectedCombinationType } from "./CardCombinations";
import { CardInfo } from "./CardInfo";
import { GameRoundState } from "./GameRoundState"; 
import { GameWinnerResult } from "./GameWinnerResult";

const _PLAYER_KEYS = {
    PLAYER1: 'player1',
    PLAYER2: 'player2',
    PLAYER3: 'player3',
    PLAYER4: 'player4',
} as const;

export type PlayerKey = typeof _PLAYER_KEYS[keyof typeof _PLAYER_KEYS];

const TEAM_KEYS = {
    TEAM_02: 'TEAM_02',
    TEAM_13: 'TEAM_13',
} as const;

export type TeamKey = typeof TEAM_KEYS[keyof typeof TEAM_KEYS];

export enum GameStatus{
    INIT = 'INIT',
    IN_PROGRESS = 'IN_PROGRESS',
    OVER = 'OVER'
}

export const TEAM_PLAYERS = {
    [TEAM_KEYS.TEAM_02]: [_PLAYER_KEYS.PLAYER1, _PLAYER_KEYS.PLAYER3],
    [TEAM_KEYS.TEAM_13]: [_PLAYER_KEYS.PLAYER2, _PLAYER_KEYS.PLAYER4],
} as const;

export const PLAYER_KEYS = [
    _PLAYER_KEYS.PLAYER1,
    _PLAYER_KEYS.PLAYER2,
    _PLAYER_KEYS.PLAYER3,
    _PLAYER_KEYS.PLAYER4
] as const;

export class RoundScore {
    team02 = 0;
    team13 = 0;
}

type PlayerEventEmitter =
    <T extends EventBase>(playerKey: PlayerKey, e: T) => void;
type GlobalEventEmitter =
    <T extends EventBase>(e: T) => void;

export class GameState {
    private _result?: GameWinnerResult;
    private _scoreHistory = Array<RoundScore>();
    private _team02TotalPoints = 0;
    private _team13TotalPoints = 0;
    readonly winningScore: number;
    private _status: GameStatus = GameStatus.INIT;
    private currentRound = new GameRoundState();
    private _playerEventEmitter?: PlayerEventEmitter;
    private _globalEventEmitter?: GlobalEventEmitter;

    constructor(
        winningScore: number = 1,
        _playerEventEmitter: <T extends EventBase>(playerKey: PlayerKey, e: T) => void,
        _globalEventEmitter: <T extends EventBase>(e: T) => void
    ) {
        this.winningScore = winningScore;
    }

    get result() {
        if (!this._result)
            throw new BusinessError('Game Result not decided yet.');
        return this._result;
    }

    get scoreHistory(): readonly RoundScore[] {
        return this._scoreHistory;
    }

    get team02TotalPoints() {
        return this._team02TotalPoints;
    }

    get team13TotalPoints() {
        return this._team13TotalPoints;
    }

    get isGameOver() {
        return this._status === GameStatus.OVER;
    }

    get status() {
        return this._status;
    }

    get emitToPlayer() {
        if (!this._playerEventEmitter)
            throw new Error('Player Emitter not set.');
        return this._playerEventEmitter;
    }

    get emitToAll() {
        if (!this._globalEventEmitter)
            throw new Error('Global Emitter not set.');
        return this._globalEventEmitter;
    }

    private getPlayer(playerKey: PlayerKey) {
        return this.currentRound.players[playerKey];
    }

    private static mapCardsToKeys(cards: CardInfo[]) {
        return cards.map(c => c.key);
    }

    private startGame() {
        if (this._status === GameStatus.IN_PROGRESS)
            throw new BusinessError('Game already started.');
        this._status = GameStatus.IN_PROGRESS;
    }

    private onAllTradesCompleted() {
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
            this._team02TotalPoints >= this.winningScore ||
            this._team13TotalPoints >= this.winningScore
        );
    }

    private endGameRound() {
        const score = this.currentRound.endGameRoundOrElseThrow();
        this._scoreHistory.push(score);
        this._team02TotalPoints += score.team02;
        this._team13TotalPoints += score.team13;
        if(this.mustEndGame()) {
            if (score.team02 > score.team13) {
                this._result = TEAM_KEYS.TEAM_02;
            } else if (score.team02 < score.team13) {
                this._result = TEAM_KEYS.TEAM_13;
            } else {
                this._result = 'TIE';
            }
            this._status = GameStatus.OVER;
        }
        return score;
    }

    private startNewRound() {
        if (!this.currentRound.isOver) {
            throw new BusinessError(
                `The current round has not been completed yet.`
            );
        }
        this.currentRound = new GameRoundState();
    }

    private onGameRoundStarted() {
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
        this.emitToAll<PlayerJoinedEvent>({
            eventType: ServerEventType.PLAYER_JOINED,
            playerKey: playerKey,
            data: {
                playerNickname: e.data.playerNickname,
            }
        });
        if (startGame) {
            this.startGame();
            this.onGameRoundStarted();
        }
    }    

    onPlayerLeft(playerKey: PlayerKey, notifyOthers = false) {
        switch (this._status) {
            case GameStatus.INIT:
                break;
            case GameStatus.IN_PROGRESS:
                if (TEAM_KEYS['TEAM_02'].includes(playerKey)) {
                    this._result = "TEAM_13";
                } else if (TEAM_KEYS['TEAM_13'].includes(playerKey)) {
                    this._result = "TEAM_02";
                } else {
                    throw new Error(
                        `Unexpected player key on disconnected player: ${playerKey}`
                    );
                }
                this._status = GameStatus.OVER;
                break;        
            default:
                throw new Error(
                    `Unexpected game status during client disconnection: ${this._status}`
                );
        }
        if (notifyOthers) {
            this.emitToAll<PlayerLeftEvent>({
                eventType: ServerEventType.PLAYER_LEFT,
                playerKey: playerKey,
                data: undefined,
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
                this.startNewRound();
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
            data: undefined,
        });
        if (this.currentRound.pendingDragonToBeGiven) {
            this.emitToAll<PendingDragonDecisionEvent>({
                eventType: ServerEventType.PENDING_DRAGON_DECISION,
                data: undefined
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
            this.onAllTradesCompleted();
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
            data: undefined,
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
