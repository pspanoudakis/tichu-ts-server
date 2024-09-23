import { Namespace, Server, Socket } from "socket.io";
import { GameClient } from "./GameClient";
import {
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
    SendMessageEvent,
    zDropBombEvent,
    zPlaceBetEvent,
    zRevealAllCardsEvent,
    zTradeCardsEvent,
    zReceiveTradeEvent,
    zPlayCardsEvent,
    zPassTurnEvent,
    zRequestCardEvent,
    zGiveDragonEvent,
    zSendMessageEvent,
    zJoinGameEvent
} from "./schemas/events/ClientEvents";
import { GameState } from "./game_logic/GameState";
import {
    ErrorEvent,
    MessageSentEvent,
    ServerEventType,
    WaitingForJoinEvent
} from "./schemas/events/ServerEvents";
import { BusinessError } from "./game_logic/BusinessError";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { GameEvent } from "./schemas/events/GameEvent";
import { ChatMessage } from "./game_logic/ChatMessage";
import { PLAYER_KEYS, PlayerKey } from "./game_logic/PlayerKeys";
import { extractErrorInfo } from "./schemas/API";

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

    constructor(sessionId: string, socketServer: CustomServer, winningScore: number) {
        this.id = sessionId;
        this.gameState = new GameState(
            winningScore,
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
            }).on(ClientEventType.JOIN_GAME, (event: any) => {
                let e;
                try {
                    e = zJoinGameEvent.parse(event);
                } catch (error) {
                    return GameSession.emitError(socket, new BusinessError(
                        `Validation Error: ${error?.toString}`
                    ));
                }
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
            }).on(ClientEventType.PLACE_BET, this.eventHandlerWrapper(
                client, zPlaceBetEvent.parse, (e: PlaceBetEvent) => {
                    this.gameState.onBetPlaced(playerKey, e);
                }
            )).on(ClientEventType.REVEAL_ALL_CARDS, this.eventHandlerWrapper(
                client, zRevealAllCardsEvent.parse, (e: RevealAllCardsEvent) => {
                    this.gameState.onAllCardsRevealed(playerKey, e);
                }
            )).on(ClientEventType.TRADE_CARDS, this.eventHandlerWrapper(
                client, zTradeCardsEvent.parse, (e: TradeCardsEvent) => {
                    this.gameState.onCardsTraded(playerKey, e);
                }
            )).on(ClientEventType.RECEIVE_TRADE, this.eventHandlerWrapper(
                client, zReceiveTradeEvent.parse, (e: ReceiveTradeEvent) => {
                    this.gameState.onTradeReceived(playerKey, e);
                }
            )).on(ClientEventType.PLAY_CARDS, this.eventHandlerWrapper(
                client, zPlayCardsEvent.parse, (e: PlayCardsEvent) => {
                    this.gameState.onCardsPlayed(playerKey, e);
                }
            )).on(ClientEventType.PASS_TURN, this.eventHandlerWrapper(
                client, zPassTurnEvent.parse, (e: PassTurnEvent) => {
                    this.gameState.onTurnPassed(playerKey, e);
                }
            )).on(ClientEventType.DROP_BOMB, this.eventHandlerWrapper(
                client, zDropBombEvent.parse, (e: DropBombEvent) => {
                    this.gameState.onBombDropped(playerKey, e);
                }
            )).on(ClientEventType.REQUEST_CARD, this.eventHandlerWrapper(
                client, zRequestCardEvent.parse, (e: RequestCardEvent) => {
                    this.gameState.onCardRequested(playerKey, e);
                }
            )).on(ClientEventType.GIVE_DRAGON, this.eventHandlerWrapper(
                client, zGiveDragonEvent.parse, (e: GiveDragonEvent) => {
                    this.gameState.onDragonGiven(playerKey, e);
                }
            )).on(ClientEventType.SEND_MESSAGE, this.eventHandlerWrapper(
                client, zSendMessageEvent.parse, (e: SendMessageEvent) => {
                    const msg = new ChatMessage(playerKey, e.data.text);
                    this.chatMessages.push(msg);
                    this.emitToNamespace<MessageSentEvent>({
                        playerKey,
                        eventType: ServerEventType.MESSAGE_SENT,
                        data: msg.toJSON(),
                    });
                }
            ));
            GameSession.emitEvent<WaitingForJoinEvent>(socket, {
                eventType: ServerEventType.WAITING_4_JOIN,
                playerKey: playerKey,
                data: {
                    winningScore: this.gameState.winningScore,
                    presentPlayers: PLAYER_KEYS.reduce<
                        {[playerKey in PlayerKey]?: string}
                    >((acc, k) => {
                        acc[k] = this.clients[k]?.nickname;
                        return acc;
                    }, {})
                },
            });
        });
    }

    private static emitError(socket: CustomSocket, error: any) {
        const { errorType: eventType, message } = extractErrorInfo(error);
        GameSession.emitEvent<ErrorEvent>(socket, {
            eventType,
            data: {
                message,
            },
        });        
    }

    private emitErrorByKey(playerKey: PlayerKey, error: any) {
        const socket = this.getSocketByPlayerKey(playerKey);
        if (!socket) return;
        GameSession.emitError(socket, error);
    }

    private eventHandlerWrapper<T extends (keyof typeof ClientEventType), D = any>(
        client: GameClient,
        validator: (e: any) => GameEvent<T, D>,
        eventHandler: (e: GameEvent<T, D>) => void,
    ) {
        return (event: any) => {
            try {
                if (!client.hasJoinedGame)
                    throw new BusinessError(`Unexpected Event '${event.eventType}'`);
                eventHandler(validator(event));
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
