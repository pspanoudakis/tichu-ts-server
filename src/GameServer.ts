import http from "http";
import { Server } from "socket.io";
import { BusinessError } from "./game_logic/BusinessError";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";
import {
    CreateRoomRequest,
    ERROR_TYPES,
    extractErrorInfo,
    SessionIdResponse,
    zCreateRoomRequest
} from "./schemas/API";

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
        this.express.get('/', (_, res) => {
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
            res.status(200).json(bodyCreator());
        } catch (err) {
            const { errorType, message } = extractErrorInfo(err);
            if (errorType === ERROR_TYPES.INTERNAL_ERROR) {
                res.status(500);
                console.log(message);
            } else {
                res.status(400);
            }
            res.json({
                errorType,
                message,
            });
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
