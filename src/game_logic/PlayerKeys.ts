import { z } from "zod";

const _PLAYER_KEYS = {
    PLAYER1: 'player1',
    PLAYER2: 'player2',
    PLAYER3: 'player3',
    PLAYER4: 'player4',
} as const;

// export type PlayerKey = typeof _PLAYER_KEYS[keyof typeof _PLAYER_KEYS];

export const zPlayerKeySchema = z.union([
    z.literal(_PLAYER_KEYS.PLAYER1),
    z.literal(_PLAYER_KEYS.PLAYER2),
    z.literal(_PLAYER_KEYS.PLAYER3),
    z.literal(_PLAYER_KEYS.PLAYER4),
]);

export type PlayerKey = z.infer<typeof zPlayerKeySchema>;

export const TEAM_KEYS = {
    TEAM_02: 'TEAM_02',
    TEAM_13: 'TEAM_13',
} as const;

export const zTeamKeySchema = z.union([
    z.literal(TEAM_KEYS.TEAM_02),
    z.literal(TEAM_KEYS.TEAM_13),
]);

// export type TeamKey = typeof TEAM_KEYS[keyof typeof TEAM_KEYS];
export type TeamKey = z.infer<typeof zTeamKeySchema>;

export const TEAM_PLAYERS = {
    [TEAM_KEYS.TEAM_02]: [_PLAYER_KEYS.PLAYER1, _PLAYER_KEYS.PLAYER3] as readonly PlayerKey[],
    [TEAM_KEYS.TEAM_13]: [_PLAYER_KEYS.PLAYER2, _PLAYER_KEYS.PLAYER4] as readonly PlayerKey[],
} as const;

export const PLAYER_KEYS = [
    _PLAYER_KEYS.PLAYER1,
    _PLAYER_KEYS.PLAYER2,
    _PLAYER_KEYS.PLAYER3,
    _PLAYER_KEYS.PLAYER4
] as const;
