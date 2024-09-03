export type GameEvent<T, D> = {
    playerKey?: string,
    eventType: T,
    data: D,
};
