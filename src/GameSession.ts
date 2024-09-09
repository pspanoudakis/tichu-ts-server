import { Namespace, Server, Socket } from "socket.io";
import { GameClient } from "./GameClient";
import { JoinGameEvent, CreateRoomEvent, ClientEventType, PlaceBetEvent, RevealAllCardsEvent, TradeCardsEvent, ReceiveTradeEvent } from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";
import { AllCardsRevealedEvent, BetPlacedEvent, CardsTradedEvent, GameRoundStartedEvent, PlayerJoinedEvent, PlayerLeftEvent, ServerEventType, TableRoundStartedEvent, WaitingForJoinEvent } from "./events/ServerEvents";
import { CardInfo } from "./game_logic/CardInfo";

type EventBase = {
    eventType: string
};

export class GameSession {
    readonly id: string;

    sessionNamespace: Namespace;
    clients: {
        [playerKey in PlayerKey]: GameClient | null;
    } = {
        player1: null,
        player2: null,
        player3: null,
        player4: null,
    };
    gameState: GameState;

    constructor(sessionId: string, socketServer: Server, event: CreateRoomEvent) {
        this.id = sessionId;
        this.gameState = new GameState(event.data.winningScore);
        this.sessionNamespace = socketServer.of(`/${sessionId}`);
        this.sessionNamespace.use((_, next) => {
            // Maybe add auth here
            next();
        }).on('connection', (socket) => {
            for (const key of PLAYER_KEYS) {
                if (this.clients[key] === null) {
                    this.clients[key] = {
                        playerKey: key,
                        socketId: socket.id,
                        nickname: '',
                        connected: false,
                    }
                    socket.on('disconnect', (reason) => {
                        console.warn(`Player: '${key}' disconnected: ${reason}`);
                        switch (this.gameState.status) {
                            case 'IN_PROGRESS':
                                // End game due to disconnection
                                break;
                            case 'INIT':
                                this.broadcastEvent<PlayerLeftEvent>(socket, {
                                    eventType: ServerEventType.PLAYER_LEFT,
                                    playerKey: key,
                                    data: undefined,
                                });
                            default:
                                break;
                        }
                    });
                    this.emitEvent<WaitingForJoinEvent>(socket, {
                        eventType: ServerEventType.WAITING_4_JOIN,
                        playerKey: key,
                        data: undefined,
                    });
                    return;
                }
            }
            // Session full, reject connection
            socket.disconnect(true);
        }).on(ClientEventType.JOIN_GAME, (e: JoinGameEvent) => {
            if (!e.playerKey) return;
            const client = this.clients[e.playerKey]
            if (!client) return;
            client.nickname = e.data.playerNickname;
            client.connected = true;
            this.broadcastEventByKey<PlayerJoinedEvent>(
                client.playerKey, {
                    eventType: ServerEventType.PLAYER_JOINED,
                    playerKey: client.playerKey,
                    data: {
                        playerNickname: client.nickname,
                    }
                }
            );
            if (PLAYER_KEYS.every(key => this.clients[key]?.connected)) {
                this.startGame();
            }
        }).on(ClientEventType.PLACE_BET, (e: PlaceBetEvent) => {
            // Validate:
            if (!e.playerKey) return;
            // Can bet at all?
            // Can bet grand tichu?
            this.gameState.currentGameboardState.playerBets[e.playerKey] = e.data.betPoints;
            this.broadcastEventByKey<BetPlacedEvent>(e.playerKey, {
                eventType: ServerEventType.BET_PLACED,
                playerKey: e.playerKey,
                data: {
                    betPoints: e.data.betPoints
                }
            })
        }).on(ClientEventType.REVEAL_ALL_CARDS, (e: RevealAllCardsEvent) => {
            // Validate:
            if (!e.playerKey) return;
            // Can reveal at all?
            this.emitEventByKey<AllCardsRevealedEvent>(e.playerKey, {
                eventType: ServerEventType.ALL_CARDS_REVEALED,
                data: {
                    cards: GameSession.mapCardsToKeys(
                        this.gameState.currentGameboardState.playerHands[e.playerKey]
                    )
                }
            });
        }).on(ClientEventType.TRADE_CARDS, (e: TradeCardsEvent) => {
            // Validate:
            if (!e.playerKey) return;
            // Can trade at all?
            // Check game phase
            // Do not allow new trade
            if (this.gameState.currentGameboardState.playerTrades[e.playerKey]) {
                return;
            }
            // Store trade...
            if (PLAYER_KEYS.every(key => this.gameState.currentGameboardState.playerTrades[key]?.length)) {
                this.onAllTradesCompleted();
            }
        }).on(ClientEventType.RECEIVE_TRADE, (e: ReceiveTradeEvent) => {
            // Validate:
            if (!e.playerKey) return;
            // Can receive at all?
            // Update...
            
            if (++this.gameState.currentGameboardState.receivedTrades === PLAYER_KEYS.length) {
                this.onAllTradesReceived();
            }

        })
    }

    private static mapCardsToKeys(cards: CardInfo[]) {
        return cards.map(c => c.key);
    }

    private emitToNamespace<T extends EventBase>(e: T) {
        this.sessionNamespace.emit(e.eventType, event);
    }

    private emitEventByKey<T extends EventBase>
    (playerKey: PlayerKey, e: T) {
        this.sessionNamespace.sockets.get(playerKey)
            ?.emit(e.eventType, event);
    }
    
    private emitEvent<T extends EventBase>
    (socket: Socket, e: T) {
        socket.emit(e.eventType, event);
    }

    private broadcastEventByKey<T extends EventBase>
    (playerKeyToExclude: PlayerKey, e: T) {
        this.sessionNamespace.sockets.get(playerKeyToExclude)
            ?.broadcast.emit(e.eventType, event);
    }
    
    private broadcastEvent<T extends EventBase>
    (socketToExclude: Socket, e: T) {
        socketToExclude.broadcast.emit(e.eventType, event);
    }

    private startGame() {
        for (const key of PLAYER_KEYS) {
            this.emitEventByKey<GameRoundStartedEvent>(key, {
                eventType: ServerEventType.GAME_ROUND_STARTED,
                data: {
                    partialCards: this.gameState.currentGameboardState.playerHands[key]
                        .map(c => c.key).slice(0, 8)
                },
            });
        }
    }

    private onAllTradesCompleted() {
        for (const key of PLAYER_KEYS) {
            this.emitEventByKey<CardsTradedEvent>(key, {
                eventType: ServerEventType.CARDS_TRADED,
                data: {
                    cardByTeammate: '',
                    cardByLeft: '',
                    cardByRight: '',
                },
            })
        }
    }

    private onAllTradesReceived() {
        this.emitToNamespace<TableRoundStartedEvent>({
            eventType: ServerEventType.TABLE_ROUND_STARTED,
            data: {
                currentPlayer: PLAYER_KEYS[this.gameState.currentGameboardState.currentPlayerIndex]
            }
        })
    }

    isFull() {
        return PLAYER_KEYS.every(key => this.clients[key] !== null);
    }
}
