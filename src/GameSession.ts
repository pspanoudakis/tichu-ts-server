import { Namespace, Server, Socket } from "socket.io";
import { GameClient } from "./GameClient";
import { JoinGameEvent, CreateRoomEvent, ClientEventType } from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";
import { PlayerJoinedEvent, PlayerLeftEvent, ServerEventType, WaitingForJoinEvent } from "./events/ServerEvents";

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
        });
        this.sessionNamespace.on('connection', (socket) => {
            for (const key of PLAYER_KEYS) {
                if (this.clients[key] === null) {
                    this.clients[key] = {
                        playerKey: key,
                        socketId: socket.id,
                        nickname: '',
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
            socket.disconnect();
        }).on(ClientEventType.JOIN_GAME, (e: JoinGameEvent) => {
            if (!e.playerKey) return;
            const client = this.clients[e.playerKey]
            if (!client) return;
            client.nickname = e.data.playerNickname;
            this.broadcastEventByKey<PlayerJoinedEvent>(
                client.playerKey, {
                    eventType: ServerEventType.PLAYER_JOINED,
                    playerKey: client.playerKey,
                    data: {
                        playerNickname: client.nickname,
                    }
                }
            );
        })
    }

    private emitEventByKey<T extends {eventType: string}>
    (playerKey: PlayerKey, event: T) {
        this.sessionNamespace.sockets.get(playerKey)
            ?.emit(event.eventType, event);
    }
    
    private emitEvent<T extends {eventType: string}>
    (socket: Socket, event: T) {
        socket.emit(event.eventType, event);
    }

    private broadcastEventByKey<T extends {eventType: string}>
    (playerKeyToExclude: PlayerKey, event: T) {
        this.sessionNamespace.sockets.get(playerKeyToExclude)
            ?.broadcast.emit(event.eventType, event);
    }
    
    private broadcastEvent<T extends {eventType: string}>
    (socketToExclude: Socket, event: T) {
        socketToExclude.broadcast.emit(event.eventType, event);
    }

    isFull() {
        return PLAYER_KEYS.every(key => this.clients[key] !== null);
    }
}
