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
    ErrorEvent,
    ServerEventType,
    WaitingForJoinEvent
} from "./events/ServerEvents";
import { BusinessError } from "./responses/BusinessError";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export type EventBase = {
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
        this.gameState = new GameState(
            event.data.winningScore,
            this.emitEventByKey,
            this.emitToNamespace
        );
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
                    this.gameState.onPlayerLeft(playerKey, client.hasJoinedGame);
                    this.clients[playerKey] = null;
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
                this.gameState.onPlayerJoined(
                    playerKey, e,
                    PLAYER_KEYS.every(k => this.clients[k]?.hasJoinedGame)
                );
            }).on(ClientEventType.PLACE_BET,
                this.eventHandlerWrapper(playerKey, (e: PlaceBetEvent) => {
                    this.gameState.onBetPlaced(playerKey, e);
                })
            ).on(ClientEventType.REVEAL_ALL_CARDS,
                this.eventHandlerWrapper(playerKey, (e: RevealAllCardsEvent) => {
                    this.gameState.onAllCardsRevealed(playerKey, e);
                })
            ).on(ClientEventType.TRADE_CARDS,
                this.eventHandlerWrapper(playerKey, (e: TradeCardsEvent) => {
                    this.gameState.onCardsTraded(playerKey, e);
                })
            ).on(ClientEventType.RECEIVE_TRADE,
                this.eventHandlerWrapper(playerKey, (e: ReceiveTradeEvent) => {
                    this.gameState.onTradeReceived(playerKey, e);
        
                })
            ).on(ClientEventType.PLAY_CARDS,
                this.eventHandlerWrapper(playerKey, (e: PlayCardsEvent) => {
                    this.gameState.onCardsPlayed(playerKey, e);
                })
            ).on(ClientEventType.PASS_TURN,
                this.eventHandlerWrapper(playerKey, (e: PassTurnEvent) => {
                    this.gameState.onTurnPassed(playerKey, e);
                })
            ).on(ClientEventType.DROP_BOMB,
                this.eventHandlerWrapper(playerKey, (e: DropBombEvent) => {
                    this.gameState.onBombDropped(playerKey, e);
                })
            ).on(ClientEventType.REQUEST_CARD,
                this.eventHandlerWrapper(playerKey, (e: RequestCardEvent) => {
                    this.gameState.onCardRequested(playerKey, e);
                })
            ).on(ClientEventType.GIVE_DRAGON,
                this.eventHandlerWrapper(playerKey, (e: GiveDragonEvent) => {
                    this.gameState.onDragonGiven(playerKey, e);
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

    isFull() {
        return PLAYER_KEYS.every(key => this.clients[key] !== null);
    }
}
