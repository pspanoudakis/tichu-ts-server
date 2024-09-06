import { RoomCreatedEvent } from "./events/ClientEvents";
import { GameSession } from "./GameSession";
import express from "express";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
    sessions = new Map<string, GameSession>();

    private constructor() {}
    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }

    addSession(sessionId: string, e: RoomCreatedEvent) {
        this.sessions.set(
            `session_${sessionId}`,
            new GameSession(this.express, sessionId, e)
        )
    }
}
