import http from "http";
import { Server } from "socket.io";
import { BusinessError } from "./responses/BusinessError";
import { ClientEventType, CreateRoomEvent, JoinGameEvent } from "./events/ClientEvents";
import { GameSession } from "./GameSession";
import express, { Response as ExpressResponse } from "express";
import { JoinGameResponse, RoomCreatedResponse } from "./responses/ServerResponses";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
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
                this.handleJoinGameEvent(req.body as JoinGameEvent)
            );
        });
        this.express.get('/', (req, res) => {
            res.send('Hello from Node TS!');
        });
        this.socketServer = new Server(
            http.createServer(express) , {
                cors: {
                    origin: '*'
                }
            }
        );
    }

    private generateSessionId() {
        return `session_${this.sessionIdSeq++}_${new Date().toISOString()}`;
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
        this.express.listen(port, () => {
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
            sessionId,
        };
    }

    handleJoinGameEvent(e: JoinGameEvent): JoinGameResponse {
        const session = this.sessions.get(e.data.sessionId);
        if (!session) 
            throw new BusinessError(
                `Session: '${e.data.sessionId}' does not exist.`
            );

        return {
            playerKey: session.addPlayerOrElseThrow(e),
            playerNicknames: {
                player1: session.clients.player1?.nickname,
                player2: session.clients.player2?.nickname,
                player3: session.clients.player3?.nickname,
                player4: session.clients.player4?.nickname,
            }
        };
    }
}
