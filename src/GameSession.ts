import { Namespace, Server, Socket } from "socket.io";
import { GameClient } from "./GameClient";
import { JoinGameEvent, CreateRoomEvent, ClientEventType, PlaceBetEvent, RevealAllCardsEvent, TradeCardsEvent, ReceiveTradeEvent, SessionClientEvent, PlayCardsEvent, PassTurnEvent, DropBombEvent, RequestCardEvent, GiveDragonEvent } from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";
import { AllCardsRevealedEvent, BetPlacedEvent, BombDroppedEvent, CardRequestedEvent, CardsPlayedEvent, CardsTradedEvent, DragonGivenEvent, ErrorEvent, GameEndedEvent, GameRoundEndedEvent, GameRoundStartedEvent, PlayerJoinedEvent, PlayerLeftEvent, ServerEventType, TableRoundStartedEvent, TurnPassedEvent, WaitingForJoinEvent } from "./events/ServerEvents";
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

    sessionNamespace: Namespace<
        DefaultEventsMap,
        DefaultEventsMap,
        DefaultEventsMap,
        CustomSocketData
    >;
    clients: {
        [playerKey in PlayerKey]: GameClient | null;
    } = {
        player1: null,
        player2: null,
        player3: null,
        player4: null,
    };
    gameState: GameState;

    // expectedEvents = new Set<ClientEventType>([ClientEventType.JOIN_GAME]);

    constructor(sessionId: string, socketServer: Server, event: CreateRoomEvent) {
        this.id = sessionId;
        this.gameState = new GameState(event.data.winningScore);
        this.sessionNamespace = socketServer.of(`/${sessionId}`);
        this.sessionNamespace.use((_, next) => {
            // Maybe add auth here
            next();
        }).on('connection', (socket) => {
            if(socket.recovered) return;
            const playerKey = PLAYER_KEYS.find(key => this.clients[key] === null);
            if (!playerKey) {
                // Session full, reject connection
                socket.disconnect(true);
                return;
            }
            const client = new GameClient(playerKey);
            socket.data.playerKey = playerKey;
            this.clients[playerKey] = client;
            const player = this.gameState.currentRound.players[playerKey];
            socket.on('disconnect', (reason) => {
                console.warn(`Player: '${playerKey}' disconnected: ${reason}`);
                switch (this.gameState.status) {
                    case 'IN_PROGRESS':
                        // End game due to disconnection
                        break;
                    case 'INIT':
                        this.clients[playerKey] = null;
                        if (client.hasJoinedGame) {
                            this.emitToNamespace<PlayerLeftEvent>({
                                eventType: ServerEventType.PLAYER_LEFT,
                                playerKey: playerKey,
                                data: undefined,
                            });                            
                        }
                    default:
                        break;
                }
            }).on(ClientEventType.JOIN_GAME, (e: JoinGameEvent) => {
                try {
                    client.joinGame();
                } catch (error) {
                    return GameSession.emitError(socket, error);
                }
                client.nickname = e.data.playerNickname;
                GameSession.broadcastEvent<PlayerJoinedEvent>(
                    socket, {
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
                    player.placeBetOrElseThrow(e);
                    GameSession.broadcastEvent<BetPlacedEvent>(socket, {
                        eventType: ServerEventType.BET_PLACED,
                        playerKey: playerKey,
                        data: {
                            betPoints: e.data.betPoints
                        }
                    })
                })
            ).on(ClientEventType.REVEAL_ALL_CARDS,
                this.eventHandlerWrapper(playerKey, (e: RevealAllCardsEvent) => {
                    player.revealCardsOrElseThrow();
                    GameSession.emitEvent<AllCardsRevealedEvent>(socket, {
                        eventType: ServerEventType.ALL_CARDS_REVEALED,
                        data: {
                            cards: GameSession.mapCardsToKeys(player.getRevealedCards()),
                        }
                    });
                })
            ).on(ClientEventType.TRADE_CARDS,
                this.eventHandlerWrapper(playerKey, (e: TradeCardsEvent) => {
                    player.finalizeTradesOrElseThrow(e);
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
                            playerKey: playerKey,
                            eventType: ServerEventType.GAME_ROUND_ENDED,
                            data: {
                                roundScore: score
                            }
                        });
                        if (this.gameState.mustEndGame()) {
                            this.emitToNamespace<GameEndedEvent>({
                                playerKey: playerKey,
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
                })
            ).on(ClientEventType.PASS_TURN,
                this.eventHandlerWrapper(playerKey, (e: PassTurnEvent) => {
                    this.gameState.currentRound.passTurnOrElseThrow(player);
                    this.emitToNamespace<TurnPassedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.TURN_PASSED,
                        data: undefined,
                    })
                })
            ).on(ClientEventType.DROP_BOMB,
                this.eventHandlerWrapper(playerKey, (e: DropBombEvent) => {
                    this.gameState.currentRound.enablePendingBombOrElseThrow(player);
                    this.emitToNamespace<BombDroppedEvent>({
                        playerKey: playerKey,
                        eventType: ServerEventType.BOMB_DROPPED,
                        data: undefined,
                    })
                })
            ).on(ClientEventType.REQUEST_CARD,
                this.eventHandlerWrapper(playerKey, (e: RequestCardEvent) => {
                    this.gameState.currentRound.setRequestedCardOrElseThrow(player, e);
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
                    this.gameState.currentRound.giveDragonOrElseThrow(player, e);
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
                data: PLAYER_KEYS.reduce((acc, k) => ({
                    ...acc,
                    [k]: this.clients[k]?.nickname,
                }), {}),
            });
        });
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
