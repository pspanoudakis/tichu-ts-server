import http from "http";
import { Express } from "express";
import { Server } from "socket.io";
import { GameClient } from "./GameClient";
import { JoinGameEvent, CreateRoomEvent } from "./events/ClientEvents";
import { GameState, PLAYER_KEYS, PlayerKey } from "./game_logic/GameState";

export class GameSession {
    readonly id: string;

    socketServer: Server;
    clients: {
        [playerKey in PlayerKey]: GameClient | null;
    } = {
        player1: null,
        player2: null,
        player3: null,
        player4: null,
    };
    gameState: GameState;

    constructor(express: Express, sessionId: string, event: CreateRoomEvent) {
        this.id = sessionId;
        this.gameState = new GameState(event.data.winningScore);
        this.socketServer = new Server(http.createServer(express));
    }

    addPlayerOrElseThrow(e: JoinGameEvent) {
        for (const key of PLAYER_KEYS) {
            if (this.clients[key] === null) {
                this.clients[key] = new GameClient(key, e.data.playerNickname);
                return key;
            }
        }
        throw new BusinessError(`Session is full.`);
    }
}
