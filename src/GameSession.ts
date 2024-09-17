import { Namespace, Server, Socket } from "socket.io";
import { GameClient } from "./GameClient";
import {
    JoinGameEvent,
    CreateRoomEvent,
    ClientEventType,
    PlaceBetEvent,
    RevealAllCardsEvent,
    TradeCardsEvent,
    ReceiveTradeEvent,
    SessionClientEvent,
    PlayCardsEvent,
    PassTurnEvent,
    DropBombEvent,
    RequestCardEvent,
    GiveDragonEvent
} from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";
import {
    AllCardsRevealedEvent,
    BetPlacedEvent,
    BombDroppedEvent,
    CardRequestedEvent,
    CardsPlayedEvent,
    CardsTradedEvent,
    DragonGivenEvent,
    ErrorEvent,
    GameEndedEvent,
    GameRoundEndedEvent,
    GameRoundStartedEvent,
    PendingDragonDecisionEvent,
    PlayerJoinedEvent,
    PlayerLeftEvent,
    ServerEventType,
    TableRoundStartedEvent,
    TurnPassedEvent,
    WaitingForJoinEvent
} from "./events/ServerEvents";
import { CardInfo } from "./game_logic/CardInfo";
import { BusinessError } from "./responses/BusinessError";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { UnexpectedCombinationType } from "./game_logic/CardCombinations";

type EventBase = {
    eventType: string
};

interface CustomSocketData {
    playerKey?: PlayerKey;
};

type CustomSocket = Socket<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    CustomSocketData
>;

export class GameSession {
    readonly id: string;

    private sessionNamespace: Namespace<
        DefaultEventsMap,
        DefaultEventsMap,
        DefaultEventsMap,
        CustomSocketData
    >;
    private clients: {
        [playerKey in PlayerKey]: GameClient | null;
    } = {
        player1: null,
        player2: null,
        player3: null,
        player4: null,
    };
    private gameState: GameState;

    // expectedEvents = new Set<ClientEventType>([ClientEventType.JOIN_GAME]);

    constructor(sessionId: string, socketServer: Server, event: CreateRoomEvent) {
        this.id = sessionId;
        this.gameState = new GameState(event.data.winningScore);
        this.sessionNamespace = socketServer.of(`/${sessionId}`);
        this.sessionNamespace.use((_, next) => {
            // Maybe add auth here?
            next();
        }).on('connection', (socket) => {
            if(socket.recovered) {
                // Emit data sync event to socket?
                return;
            };
            const playerKey = PLAYER_KEYS.find(key => this.clients[key] === null);
            if (!playerKey) {
                // Session full, reject connection
                socket.disconnect(true);
                return;
            }
            const client = new GameClient(playerKey);
            socket.data.playerKey = playerKey;
            this.clients[playerKey] = client;
            socket.on('disconnect', (reason) => {
                console.warn(`Player: '${playerKey}' disconnected: ${reason}`);
                try {
                    this.gameState.onPlayerLeft(playerKey);
                    this.clients[playerKey] = null;
                    if (client.hasJoinedGame) {
                        this.emitToNamespace<PlayerLeftEvent>({
                            eventType: ServerEventType.PLAYER_LEFT,
                            playerKey: playerKey,
                            data: undefined,
                        });
                        this.onGamePossiblyOver();
                    }      
                } catch (error) {
                    console.error(
                        `Error during client disconnection: ${error?.toString()}`
                    );
                }
            }).on(ClientEventType.JOIN_GAME, (e: JoinGameEvent) => {
                try {
                    client.joinGame();
                } catch (error) {
                    return GameSession.emitError(socket, error);
                }
                client.nickname = e.data.playerNickname;
                this.emitToNamespace<PlayerJoinedEvent>({
                        eventType: ServerEventType.PLAYER_JOINED,
                        playerKey: playerKey,
                        data: {
                            playerNickname: client.nickname,
                        }
                    }
                );
                if (PLAYER_KEYS.every(k => this.clients[k]?.hasJoinedGame)) {
                    this.startGame();
                }
            }).on(ClientEventType.PLACE_BET,
                this.eventHandlerWrapper(playerKey, (e: PlaceBetEvent) => {
                    this.getPlayer(playerKey).placeBetOrElseThrow(e);
                    this.emitToNamespace<BetPlacedEvent>({
                        eventType: ServerEventType.BET_PLACED,
                        playerKey: playerKey,
                        data: {
                            betPoints: e.data.betPoints
                        }
                    })
                })
            ).on(ClientEventType.REVEAL_ALL_CARDS,
                this.eventHandlerWrapper(playerKey, (e: RevealAllCardsEvent) => {
                    this.getPlayer(playerKey).revealCardsOrElseThrow();
                    GameSession.emitEvent<AllCardsRevealedEvent>(socket, {
                        eventType: ServerEventType.ALL_CARDS_REVEALED,
                        data: {
                            cards: GameSession.mapCardsToKeys(
                                this.getPlayer(playerKey).getRevealedCards()
                            ),
                        }
                    });
                })
            ).on(ClientEventType.TRADE_CARDS,
                this.eventHandlerWrapper(playerKey, (e: TradeCardsEvent) => {
                    this.getPlayer(playerKey).finalizeTradesOrElseThrow(e);
                    if (PLAYER_KEYS.every(
                        k => this.gameState.currentRound.players[k].hasSentTrades
                    )) {
                        this.onAllTradesCompleted();
                    }
                })
            ).on(ClientEventType.RECEIVE_TRADE,
                this.eventHandlerWrapper(playerKey, (e: ReceiveTradeEvent) => {
                    if (PLAYER_KEYS.every(
                        k => this.gameState.currentRound.players[k].hasReceivedTrades
                    )) {
                        this.onAllTradesReceived();
                    }
        
                })
            ).on(ClientEventType.PLAY_CARDS,
                this.eventHandlerWrapper(playerKey, (e: PlayCardsEvent) => {
                    const player = this.getPlayer(playerKey);
                    this.gameState.currentRound.playCardsOrElseThrow(
                        player, e.data.selectedCardKeys
                    );
                    const combType = 
                        this.gameState.currentRound.table.currentCombination?.type;
                    if (!combType) throw new UnexpectedCombinationType (
                        'Unexpected Error: Table combination is null'
                    );
                    this.emitToNamespace<CardsPlayedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.CARDS_PLAYED,
                        data: {
                            combinationType: combType,
                            numCardsRemainingInHand: player.getNumCards(),
                            tableCardKeys: GameSession.mapCardsToKeys(player.getCards()),
                            requestedCardName: 
                                this.gameState.currentRound.table.requestedCardName,
                        }
                    });
                    if (this.gameState.currentRound.mustEndGameRound()) {
                        const score = this.gameState.endGameRound();
                        this.emitToNamespace<GameRoundEndedEvent>({
                            eventType: ServerEventType.GAME_ROUND_ENDED,
                            data: {
                                roundScore: score
                            }
                        });
                        this.onGamePossiblyOver();
                        if (!this.gameState.isGameOver) {
                            this.gameState.endGameRound();
                        } 
                    }
                })
            ).on(ClientEventType.PASS_TURN,
                this.eventHandlerWrapper(playerKey, (e: PassTurnEvent) => {
                    this.gameState.currentRound
                        .passTurnOrElseThrow(this.getPlayer(playerKey));
                    this.emitToNamespace<TurnPassedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.TURN_PASSED,
                        data: undefined,
                    });
                    if (this.gameState.currentRound.pendingDragonToBeGiven) {
                        this.emitToNamespace<PendingDragonDecisionEvent>({
                            eventType: ServerEventType.PENDING_DRAGON_DECISION,
                            data: undefined
                        })
                    }
                })
            ).on(ClientEventType.DROP_BOMB,
                this.eventHandlerWrapper(playerKey, (e: DropBombEvent) => {
                    this.gameState.currentRound
                        .enablePendingBombOrElseThrow(this.getPlayer(playerKey));
                    this.emitToNamespace<BombDroppedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.BOMB_DROPPED,
                        data: undefined,
                    })
                })
            ).on(ClientEventType.REQUEST_CARD,
                this.eventHandlerWrapper(playerKey, (e: RequestCardEvent) => {
                    this.gameState.currentRound
                        .setRequestedCardOrElseThrow(this.getPlayer(playerKey), e);
                    this.emitToNamespace<CardRequestedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.CARD_REQUESTED,
                        data: {
                            requestedCardName: e.data.requestedCardName
                        },
                    })
                })
            ).on(ClientEventType.GIVE_DRAGON,
                this.eventHandlerWrapper(playerKey, (e: GiveDragonEvent) => {
                    this.gameState.currentRound
                        .giveDragonOrElseThrow(this.getPlayer(playerKey), e);
                    this.emitToNamespace<DragonGivenEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.DRAGON_GIVEN,
                        data: {
                            dragonReceiverKey: e.data.chosenOponentKey
                        },
                    })
                })
            );
            GameSession.emitEvent<WaitingForJoinEvent>(socket, {
                eventType: ServerEventType.WAITING_4_JOIN,
                playerKey: playerKey,
                data: {
                    winningScore: this.gameState.winningScore,
                    presentPlayers: PLAYER_KEYS.reduce((acc, k) => ({
                        ...acc,
                        [k]: this.clients[k]?.nickname,
                    }), {})
                },
            });
        });
    }

    private getPlayer(playerKey: PlayerKey) {
        return this.gameState.currentRound.players[playerKey];
    }

    private onGamePossiblyOver() {
        if (this.gameState.isGameOver) {
            this.emitToNamespace<GameEndedEvent>({
                eventType: ServerEventType.GAME_ENDED,
                data: {
                    result: this.gameState.result,
                    team02TotalScore: this.gameState.team02TotalPoints,
                    team13TotalScore: this.gameState.team13TotalPoints,
                    scores: this.gameState.scoreHistory,
                }
            });
        }
    }

    private static emitError(socket: CustomSocket, error: any) {
        GameSession.emitEvent<ErrorEvent>(socket, {
            eventType: 
                (error instanceof BusinessError) ?
                ServerEventType.BUSINESS_ERROR :
                ServerEventType.UNKNOWN_SERVER_ERROR,
            data: { message: error?.toString?.() ?? JSON.stringify(error) },
        });        
    }

    private emitErrorByKey(playerKey: PlayerKey, error: any) {
        const socket = this.getSocketByPlayerKey(playerKey);
        if (!socket) return;
        GameSession.emitError(socket, error);
    }

    private eventHandlerWrapper<T extends ClientEventType, D = any>(
        playerKey: PlayerKey,
        eventHandler: (e: SessionClientEvent<T, D>) => void
    ) {
        return (event: SessionClientEvent<T, D>) => {
            try {
                // if (!this.expectedEvents.has(event.eventType))
                //     throw new BusinessError(`Unexpected Event '${event.eventType}'`);
                if (!this.clients[playerKey]?.hasJoinedGame)
                    throw new BusinessError(`Unexpected Event '${event.eventType}'`);
                eventHandler(event);
            } catch (error) {
                this.emitErrorByKey(playerKey, error);
            }
        };
    }

    private static mapCardsToKeys(cards: CardInfo[]) {
        return cards.map(c => c.key);
    }

    private getSocketByPlayerKey(key: PlayerKey) {
        for (const s of this.sessionNamespace.sockets.values()) {
            if (s.data.playerKey === key)
                return s;
        }
    }

    private emitToNamespace<T extends EventBase>(e: T) {
        this.sessionNamespace.emit(e.eventType, e);
    }

    private emitEventByKey<T extends EventBase>
    (playerKey: PlayerKey, e: T) {
        this.getSocketByPlayerKey(playerKey)?.emit(e.eventType, e);
    }
    
    private static emitEvent<T extends EventBase>
    (socket: CustomSocket, e: T) {
        socket.emit(e.eventType, e);
    }

    private broadcastEventByKey<T extends EventBase>
    (playerKeyToExclude: PlayerKey, e: T) {
        this.getSocketByPlayerKey(playerKeyToExclude)
            ?.broadcast.emit(e.eventType, e);
    }
    
    private static broadcastEvent<T extends EventBase>
    (socketToExclude: CustomSocket, e: T) {
        socketToExclude.broadcast.emit(e.eventType, e);
    }

    private startGame() {
        this.gameState.startGame();
        for (const key of PLAYER_KEYS) {
            const player = this.gameState.currentRound.players[key];
            this.emitEventByKey<GameRoundStartedEvent>(key, {
                eventType: ServerEventType.GAME_ROUND_STARTED,
                data: {
                    partialCards: GameSession.mapCardsToKeys(player.getRevealedCards())
                },
            });
        }
    }

    private onAllTradesCompleted() {
        this.gameState.currentRound.makeCardTrades();
        for (const key of PLAYER_KEYS) {
            const player = this.gameState.currentRound.players[key];
            this.emitEventByKey<CardsTradedEvent>(key, {
                eventType: ServerEventType.CARDS_TRADED,
                data: {
                    cardByTeammate: player.incomingTrades.teammate.key,
                    cardByLeft: player.incomingTrades.left.key,
                    cardByRight: player.incomingTrades.right.key,
                },
            })
        }
    }

    private onAllTradesReceived() {
        this.emitToNamespace<TableRoundStartedEvent>({
            eventType: ServerEventType.TABLE_ROUND_STARTED,
            data: {
                currentPlayer: PLAYER_KEYS[this.gameState.currentRound.currentPlayerIndex]
            }
        })
    }

    isFull() {
        return PLAYER_KEYS.every(key => this.clients[key] !== null);
    }
}
