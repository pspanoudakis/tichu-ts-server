import { BusinessError } from "./controllers/BusinessError";
import { ClientEventType, CreateRoomEvent, JoinGameEvent } from "./events/ClientEvents";
import { PlayerJoinedEvent, RoomCreatedEvent, ServerEventType } from "./events/ServerEvents";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
    sessions = new Map<string, GameSession>();
    private sessionIdSeq = 0;

    private constructor() {
        this.express.use(express.json());
        this.express.post('/', (req, res) => {
            // validate...
            GameServer.responseCreator(res, () => 
                this.handleCreateRoomEvent(req.body as CreateRoomEvent)
            );
        });
        this.express.post('/join', (req, res) => {
            // validate...
            GameServer.responseCreator(res, () => 
                this.handleJoinGameEvent(req.body as JoinGameEvent)
            );
        });
        this.express.get('/', (req, res) => {
            res.send('Hello from Node TS!');
        });
    }

    private generateSessionId() {
        return `session_${this.sessionIdSeq++}_${new Date().toISOString()}`;
    }

    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }

    static responseCreator(res: ExpressResponse, bodyCreator: () => any) {
        try {
            res.status(200).json(bodyCreator());
        } catch (err) {
            if (err instanceof BusinessError)
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
        if (this.sessions.has(sessionId))
            throw new Error(`Regenerated existing session id: '${sessionId}'`);
        this.sessions.set(sessionId, session);
        // Add player in session
        const outEvt = this.handleJoinGameEvent({
            eventType: ClientEventType.JOIN_GAME,
            data: {
                sessionId,
                playerNickname: e.data.playerNickname
            }
        });
        return {
            playerKey: outEvt.playerKey,
            eventType: ServerEventType.ROOM_CREATED,
            data: {
                sessionId,
            },
        };
    }

    handleJoinGameEvent(e: JoinGameEvent): PlayerJoinedEvent {
        const session = this.sessions.get(e.data.sessionId);
        if (!session) 
            throw new BusinessError(
                `Session: '${e.data.sessionId}' does not exist.`
            );

        const evt: PlayerJoinedEvent = {
            eventType: ServerEventType.PLAYER_JOINED,
            playerKey: session.addPlayerOrElseThrow(e),
            data: {
                playerNickname: e.data.playerNickname
            }
        };
        // broadcast join in other players

        return evt;
    }
}
