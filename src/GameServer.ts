import http from "http";
import { Server } from "socket.io";
import { BusinessError } from "./game_logic/BusinessError";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";
import { z } from "zod";

export const zCreateRoomRequest = z.object({
    winningScore: z.number()
});
type CreateRoomRequest = z.infer<typeof zCreateRoomRequest>;

export const zSessionIdResponse = z.object({
    sessionId: z.string(),
});
type SessionIdResponse = z.infer<typeof zSessionIdResponse>;

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
                this.handleCreateRoomEvent(zCreateRoomRequest.parse(req.body))
            );
        });
        this.express.get('/join', (_, res) => {
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
                },
                connectionStateRecovery: {
                    maxDisconnectionDuration: 1 * 60 * 1000,
                    skipMiddlewares: true,
                },
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
                console.error(err?.toString?.());
                res.status(500);
            res.send({ error: String(err) });
        }
    }

    listen(port: number, callback: () => any) {
        this.httpServer.listen(port, callback);
    }

    handleCreateRoomEvent(req: CreateRoomRequest): SessionIdResponse {
        // Create new session
        const sessionId = this.generateSessionId();
        const session = new GameSession(
            sessionId, this.socketServer, req.winningScore
        );
        if (this.sessions.has(sessionId))
            throw new Error(`Regenerated existing session id: '${sessionId}'`);
        this.sessions.set(sessionId, session);
        // Player will be added in session as soon as socket connection is established.
        return {
            sessionId,
        };
    }

    handleJoinGameEvent(): SessionIdResponse {
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
