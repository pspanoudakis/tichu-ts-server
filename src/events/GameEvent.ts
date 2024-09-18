import { PlayerKey } from "../game_logic/PlayerState";

export type CardKey = string;

export type CardName = string;

export type GameEvent<T, D = undefined> = {
    playerKey?: PlayerKey,
    eventType: T,
    data: D,
};
