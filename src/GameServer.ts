import { ClientEventType, CreateRoomEvent } from "./events/ClientEvents";
import { RoomCreatedEvent, ServerEventType } from "./events/ServerEvents";
import { GameSession } from "./GameSession";
import express from "express";

export class GameServer {

    private static instance: GameServer | null = null;

    private sessionIdSeq = 0;
    express = express();
    sessions = new Map<string, GameSession>();

    private constructor() {}
    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }

    private generateSessionId() {
        return String(this.sessionIdSeq++);
    }

    handleCreateRoomEvent(e: CreateRoomEvent): RoomCreatedEvent {
        // Create new session
        const sessionId = this.generateSessionId();
        const session = new GameSession(this.express, sessionId, e);
        this.sessions.set(`session_${sessionId}`, session);
        const playerKey = session.addPlayerOrElseThrow({
            eventType: ClientEventType.JOIN_GAME,
            data: {
                playerNickname: e.data.playerNickname
            }
        });
        return {
            eventType: ServerEventType.ROOM_CREATED,
            data: {
                sessionId,
                playerKey,
            }
        }
    }
}
