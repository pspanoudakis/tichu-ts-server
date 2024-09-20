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
    PlayCardsEvent,
    PassTurnEvent,
    DropBombEvent,
    RequestCardEvent,
    GiveDragonEvent,
    SendMessageEvent
} from "./events/ClientEvents";
import { GameState } from "./game_logic/GameState";
import {
    ErrorEvent,
    MessageSentEvent,
    ServerEventType,
    WaitingForJoinEvent
} from "./events/ServerEvents";
import { BusinessError } from "./responses/BusinessError";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { PLAYER_KEYS, PlayerKey } from "./game_logic/PlayerState";
import { GameEvent } from "./events/GameEvent";
import { ChatMessage } from "./ChatMessage";

export type EventBase = GameEvent<any, any>;

interface CustomSocketData {
    playerKey?: PlayerKey;
};

type CustomSocket = Socket<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    CustomSocketData
>;

type CustomServer = Server<
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

    private chatMessages = new Array<ChatMessage>();

    constructor(sessionId: string, socketServer: CustomServer, event: CreateRoomEvent) {
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
                this.eventHandlerWrapper(client, (e: PlaceBetEvent) => {
                    this.gameState.onBetPlaced(playerKey, e);
                })
            ).on(ClientEventType.REVEAL_ALL_CARDS,
                this.eventHandlerWrapper(client, (e: RevealAllCardsEvent) => {
                    this.gameState.onAllCardsRevealed(playerKey, e);
                })
            ).on(ClientEventType.TRADE_CARDS,
                this.eventHandlerWrapper(client, (e: TradeCardsEvent) => {
                    this.gameState.onCardsTraded(playerKey, e);
                })
            ).on(ClientEventType.RECEIVE_TRADE,
                this.eventHandlerWrapper(client, (e: ReceiveTradeEvent) => {
                    this.gameState.onTradeReceived(playerKey, e);
        
                })
            ).on(ClientEventType.PLAY_CARDS,
                this.eventHandlerWrapper(client, (e: PlayCardsEvent) => {
                    this.gameState.onCardsPlayed(playerKey, e);
                })
            ).on(ClientEventType.PASS_TURN,
                this.eventHandlerWrapper(client, (e: PassTurnEvent) => {
                    this.gameState.onTurnPassed(playerKey, e);
                })
            ).on(ClientEventType.DROP_BOMB,
                this.eventHandlerWrapper(client, (e: DropBombEvent) => {
                    this.gameState.onBombDropped(playerKey, e);
                })
            ).on(ClientEventType.REQUEST_CARD,
                this.eventHandlerWrapper(client, (e: RequestCardEvent) => {
                    this.gameState.onCardRequested(playerKey, e);
                })
            ).on(ClientEventType.GIVE_DRAGON,
                this.eventHandlerWrapper(client, (e: GiveDragonEvent) => {
                    this.gameState.onDragonGiven(playerKey, e);
                })
            ).on(ClientEventType.SEND_MESSAGE,
                this.eventHandlerWrapper(client, (e: SendMessageEvent) => {
                    const msg = new ChatMessage(playerKey, e.data.text);
                    this.chatMessages.push(msg);
                    this.emitToNamespace<MessageSentEvent>({
                        playerKey,
                        eventType: ServerEventType.MESSAGE_SENT,
                        data: msg.toJSON(),
                    });
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

    private eventHandlerWrapper<T extends (keyof typeof ClientEventType), D = any>(
        client: GameClient, eventHandler: (e: GameEvent<T, D>) => void
    ) {
        return (event: GameEvent<T, D>) => {
            try {
                if (!client.hasJoinedGame)
                    throw new BusinessError(`Unexpected Event '${event.eventType}'`);
                eventHandler(event);
            } catch (error) {
                this.emitErrorByKey(client.playerKey, error);
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

    private emitEventByKey<T extends EventBase>(playerKey: PlayerKey, e: T) {
        this.getSocketByPlayerKey(playerKey)?.emit(e.eventType, e);
    }
    
    private static emitEvent<T extends EventBase>(socket: CustomSocket, e: T) {
        socket.emit(e.eventType, e);
    }

    isFull() {
        return PLAYER_KEYS.every(key => this.clients[key] !== null);
    }
}
