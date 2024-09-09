import { PlayerKey } from "./game_logic/GameState";

export type GameClient = {
    readonly playerKey: PlayerKey,
    readonly socketId: string,
    nickname: string,
    connected: boolean;
};
