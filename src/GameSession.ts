import { GameClient } from "./GameClient";
import { GameState, PlayerKey } from "./game_logic/GameState";

export class GameSession {
    readonly id: string;
    gameState: GameState;
    clients: {
        [playerKey in PlayerKey]: GameClient | null;
    } = {
        player1: null,
        player2: null,
        player3: null,
        player4: null,
    };

    constructor(sessionId: string) {
        this.id = sessionId;
    }
}
