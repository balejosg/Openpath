export interface TRPCResponse<T = unknown> {
  result?: { data: T };
  error?: { message: string; code: string; data?: { code: string } };
}

export interface UserResult {
  id: string;
  email: string;
  name: string;
  roles?: { id: string; role: string; groupIds: string[] }[];
}

export interface AuthResult {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  user?: UserResult;
  verificationRequired?: boolean;
  verificationToken?: string;
  verificationExpiresAt?: string;
}

export interface RequestResult {
  id: string;
  domain?: string;
  status?: string;
  reason?: string;
}

export interface RoleResult {
  id: string;
  role: string;
  groupIds: string[];
}

export async function trpcMutate(
  baseUrl: string,
  procedure: string,
  input: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return fetch(`${baseUrl}/trpc/${procedure}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  });
}

export async function trpcQuery(
  baseUrl: string,
  procedure: string,
  input?: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  let url = `${baseUrl}/trpc/${procedure}`;
  if (input !== undefined) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
  }
  return fetch(url, { headers });
}

export async function parseTRPC(response: Response): Promise<{
  data?: unknown;
  error?: string;
  code?: string;
}> {
  const json = (await response.json()) as TRPCResponse;
  if (json.result !== undefined) {
    return { data: json.result.data };
  }
  if (json.error !== undefined) {
    return {
      error: json.error.message,
      code: json.error.data?.code ?? json.error.code,
    };
  }
  return {};
}

export function bearerAuth(token: string | null): Record<string, string> {
  if (token === null || token === '') return {};
  return { Authorization: `Bearer ${token}` };
}

export function assertStatus(response: Response, expected: number, message?: string): void {
  if (response.status !== expected) {
    const msg = message ?? `Expected status ${String(expected)}, got ${String(response.status)}`;
    throw new Error(msg);
  }
}
