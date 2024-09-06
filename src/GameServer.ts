import { ClientEventType, CreateRoomEvent } from "./events/ClientEvents";
import { RoomCreatedEvent, ServerEventType } from "./events/ServerEvents";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
    sessions = new Map<string, GameSession>();
    private sessionIdSeq = 0;

    private constructor() {
        this.express.post('/', (req, res) => {
            // validate...
            GameServer.responseCreator(res, () => 
                this.handleCreateRoomEvent(req.body as CreateRoomEvent)
            );
        });
        this.express.get('/', (req, res) => {
            res.send('Hello from Node TS!');
        });
    }

    private generateSessionId() {
        return String(this.sessionIdSeq++);
    }

    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }

    static responseCreator(res: ExpressResponse, bodyCreator: () => any) {
        try {
            res.status(200).send(bodyCreator());
        } catch (err) {
            if (err instanceof BadRequestError)
                res.status(400);
            else
                res.status(500);
            res.send({ error: String(err) });
        }
    }

    listen(port: number) {
        this.express.listen(port, () => {
            console.info(`Node.js TS server running on port [${port}]`);
        });
    }

    handleCreateRoomEvent(e: CreateRoomEvent): RoomCreatedEvent {
        // Create new session
        const sessionId = this.generateSessionId();
        const session = new GameSession(this.express, sessionId, e);
        this.sessions.set(
            `session_${sessionId}_${new Date().toISOString()}`, session
        );
        // Add player in session
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
