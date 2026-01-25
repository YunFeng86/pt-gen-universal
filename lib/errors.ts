export enum ErrorCode {
    INVALID_PARAM = "INVALID_PARAM",
    AUTH_FAILED = "AUTH_FAILED",
    TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
    TARGET_BLOCKING = "TARGET_BLOCKING",
    TARGET_TIMEOUT = "TARGET_TIMEOUT",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    PROXY_EXHAUSTED = "PROXY_EXHAUSTED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}

export const HTTP_STATUS: Record<ErrorCode, number> = {
    [ErrorCode.INVALID_PARAM]: 400,
    [ErrorCode.AUTH_FAILED]: 401,
    [ErrorCode.TARGET_NOT_FOUND]: 404,
    [ErrorCode.TARGET_BLOCKING]: 502,
    [ErrorCode.TARGET_TIMEOUT]: 504,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.PROXY_EXHAUSTED]: 503,
    [ErrorCode.UNKNOWN_ERROR]: 500,
};

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly details?: any;
    public readonly httpStatus: number;

    constructor(code: ErrorCode, message: string, details?: any) {
        super(message);
        this.code = code;
        this.details = details;
        this.httpStatus = HTTP_STATUS[code] || 500;
        this.name = "AppError";
    }
}
