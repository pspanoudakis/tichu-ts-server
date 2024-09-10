import { PlayerKey } from "./game_logic/GameState";

export type GameClient = {
    readonly playerKey: PlayerKey,
    nickname: string,
    connected: boolean;
};
