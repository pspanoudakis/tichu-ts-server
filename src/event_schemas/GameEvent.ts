import { PlayerKey } from "../game_logic/GameState";

export type CardKey = string;

export type CardName = string;

export type GameEvent<T, D> = {
    playerKey?: PlayerKey,
    eventType: T,
    data: D,
};
