export interface VersionInfo {
    schema: string;
    parser: string;
    source_fingerprint?: string;
}

export interface Warning {
    field: string;
    reason: string;
    message: string;
}

export interface MetaInfo {
    api_version: string;
    generated_at_ms: number;
    trace_id?: string;
    source_url?: string;
    warnings?: Warning[];
}

export interface ApiV2SuccessResponse<T = any> {
    versions: VersionInfo;
    meta: MetaInfo;
    data: T;
}

export interface ApiV2ErrorDetail {
    code: string;
    message: string;
    request_id?: string;
    details?: any;
    help_url?: string;
}

export interface ApiV2ErrorResponse {
    error: ApiV2ErrorDetail;
}

export type ApiV2Response<T = any> = ApiV2SuccessResponse<T> | ApiV2ErrorResponse;
