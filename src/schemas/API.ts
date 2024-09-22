import { z, ZodLiteral } from "zod";

export const zCreateRoomRequest = z.object({
    winningScore: z.number()
});
export type CreateRoomRequest = z.infer<typeof zCreateRoomRequest>;

export const zSessionIdResponse = z.object({
    sessionId: z.string(),
});
export type SessionIdResponse = z.infer<typeof zSessionIdResponse>;

export const ErrorType = {
    BUSINESS_ERROR: 'BUSINESS_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

function createErrorResponseSchema<ET extends string>(errorType: ET) {
    return z.object({
        errorType: z.literal(errorType),
        message: z.string(),
    });
}

export const zBusinessErrorResponse =
    createErrorResponseSchema(ErrorType.BUSINESS_ERROR);
export type BusinessErrorResponse = z.infer<typeof zBusinessErrorResponse>;

export const zValidationErrorResponse = 
    createErrorResponseSchema(ErrorType.VALIDATION_ERROR);
export type ValidationErrorResponse = z.infer<typeof zValidationErrorResponse>;

export const zInternalErrorResponse =
    createErrorResponseSchema(ErrorType.INTERNAL_ERROR);
export type InternalErrorResponse = z.infer<typeof zInternalErrorResponse>;
