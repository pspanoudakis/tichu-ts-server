import { z, ZodError } from "zod";
import { BusinessError } from "../game_logic/BusinessError";

export const zCreateRoomRequest = z.object({
    winningScore: z.number()
});
export type CreateRoomRequest = z.infer<typeof zCreateRoomRequest>;

export const zSessionIdResponse = z.object({
    sessionId: z.string(),
});
export type SessionIdResponse = z.infer<typeof zSessionIdResponse>;

export const ERROR_TYPES = {
    BUSINESS_ERROR: 'BUSINESS_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];

export const zErrorResponse = z.object({
    errorType: z.nativeEnum(ERROR_TYPES),
    message: z.string(),
});
export type ErrorResponse = z.infer<typeof zErrorResponse>;

export function extractErrorInfo(error: any) {
    let errorType: ErrorType;
    let message: string;
    if (error instanceof BusinessError) {
        errorType = ERROR_TYPES.BUSINESS_ERROR;
        message = error.toString();
    } else if (error instanceof ZodError) {
        errorType = ERROR_TYPES.VALIDATION_ERROR;
        message = JSON.stringify(error);
    } else {
        errorType = ERROR_TYPES.INTERNAL_ERROR;
        message = error?.toString?.() ?? JSON.stringify(error);
    }
    return {
        errorType,
        message,
    };
}
