import { PlayerKey } from "./game_logic/GameState";

export class GameClient {
    nickname: string;
    playerKey: PlayerKey;

    constructor(playerKey: PlayerKey, nickname: string) {
        this.nickname = nickname;
        this.playerKey = playerKey;
    }
}
