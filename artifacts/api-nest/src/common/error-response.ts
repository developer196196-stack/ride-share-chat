/** Shared API error body — keep in sync with OpenAPI `ErrorResponse`. */
export type ErrorResponseBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};
