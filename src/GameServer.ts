import { GameSession } from "./GameSession";

export class GameServer {

    private static instance: GameServer | null = null;

    express = express();
    sessions = new Map<string, GameSession>();

    private constructor() {}
    static getInstance() {
        return (GameServer.instance ??= new GameServer());
    }
}
