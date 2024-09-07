import { Namespace, Server } from "socket.io";
import { GameClient } from "./GameClient";
import { JoinGameEvent, CreateRoomEvent } from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";
import { BusinessError } from "./responses/BusinessError";
import { PlayerJoinedEvent, ServerEventType } from "./events/ServerEvents";

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
    }

    private broadcastEvent<T extends {eventType: string}>
    (playerKeyToExclude: PlayerKey, event: T) {
        this.sessionNamespace.sockets.get(playerKeyToExclude)
            ?.broadcast.emit(event.eventType, event);
    }

    addPlayerOrElseThrow(e: JoinGameEvent) {
        for (const key of PLAYER_KEYS) {
            if (this.clients[key] === null) {
                this.clients[key] = new GameClient(key, e.data.playerNickname);
                this.broadcastEvent<PlayerJoinedEvent>(key, {
                    eventType: ServerEventType.PLAYER_JOINED,
                    playerKey: key,
                    data: {
                        playerNickname: e.data.playerNickname
                    }
                })
                return key;
            }
        }
        throw new BusinessError(`Session is full.`);
    }
}
