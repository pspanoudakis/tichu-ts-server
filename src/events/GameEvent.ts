import { z } from "zod";
import { PLAYER_KEYS, PlayerKey } from "../game_logic/PlayerKeys";

export const zCardKey = z.string();
export const zCardName = z.string();

const PlayerKeySchema = z.union([
    z.literal(PLAYER_KEYS[0]),
    z.literal(PLAYER_KEYS[1]),
    z.literal(PLAYER_KEYS[2]),
    z.literal(PLAYER_KEYS[3]),
]);

export function createGameEventSchema<
    EventType extends z.ZodTypeAny,
    DataType extends z.ZodTypeAny
>(
    eventTypeSchema: EventType,
    dataTypeSchema: DataType
) {
    return z.object({
        playerKey: z.optional(PlayerKeySchema),
        eventType: eventTypeSchema,
        data: dataTypeSchema
    });
};
export function createEmptyGameEventSchema<EventType extends z.ZodTypeAny>
(eventTypeSchema: EventType) {
    return z.object({
        playerKey: z.optional(PlayerKeySchema),
        eventType: eventTypeSchema
    });
};
const zGameEventSchema = createGameEventSchema(z.string(), z.void());
// export type GameEvent = z.infer<typeof zGameEventSchema>;

export type GameEvent<T, D = void> = {
    playerKey?: PlayerKey,
    eventType: T,
} & (
    D extends void ? { data?: never } : { data: D }
);
