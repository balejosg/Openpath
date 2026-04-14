export type RequestServiceError =
  | { code: 'CONFLICT'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'BAD_REQUEST'; message: string };

export type RequestResult<T> = { ok: true; data: T } | { ok: false; error: RequestServiceError };
