import http from "http";
import { Server } from "socket.io";
import { BusinessError } from "./responses/BusinessError";
import { CreateRoomEvent } from "./events/ClientEvents";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";
import { JoinGameResponse, RoomCreatedResponse } from "./responses/ServerResponses";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
    httpServer: http.Server;
    socketServer: Server;
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
                this.handleJoinGameEvent()
            );
        });
        this.express.get('/', (req, res) => {
            res.send('Hello from Node TS!');
        });
        this.httpServer = http.createServer(this.express);
        this.socketServer = new Server(
            this.httpServer, {
                cors: {
                    origin: '*'
                }
            }
        );
    }

    private generateSessionId() {
        // return `session_${this.sessionIdSeq++}_${new Date().toISOString()}`;
        return `session_${this.sessionIdSeq++}`;
    }

    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }

    static responseCreator(res: ExpressResponse, bodyCreator: () => any) {
        try {
            res.json(bodyCreator()).status(200);
        } catch (err) {
            if (err instanceof BusinessError)
                res.status(400);
            else
                res.status(500);
            res.send({ error: String(err) });
        }
    }

    listen(port: number) {
        this.httpServer.listen(port, () => {
            console.info(`Node.js TS server running on port [${port}]`);
        });
    }

    handleCreateRoomEvent(e: CreateRoomEvent): RoomCreatedResponse {
        // Create new session
        const sessionId = this.generateSessionId();
        const session = new GameSession(sessionId, this.socketServer, e);
        if (this.sessions.has(sessionId))
            throw new Error(`Regenerated existing session id: '${sessionId}'`);
        this.sessions.set(sessionId, session);
        // Player will be added in session as soon as socket connection is established.
        return {
            sessionId,
        };
    }

    handleJoinGameEvent(): JoinGameResponse {
        for (const session of this.sessions.values()) {
            if (!session.isFull()) {
                return {
                    sessionId: session.id,
                };
            }
        }
        throw new BusinessError(
            `No sessions that can be joined were found.`
        );
    }
}
