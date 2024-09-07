import { PlayerKey } from "../game_logic/GameState"

export type RoomCreatedResponse = {
    playerKey: PlayerKey,
    sessionId: string,
}

export type JoinGameResponse =  {
    playerKey: PlayerKey,
    playerNicknames: {
        [key in PlayerKey]: string | undefined
    },
};
