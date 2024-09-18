import { PlayerKey } from "../game_logic/PlayerState";

export type CardKey = string;

export type CardName = string;

export type GameEvent<T, D = void> = {
    playerKey?: PlayerKey,
    eventType: T,
} & (
    D extends void ? { data?: never } : { data: D }
);
