export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_STORAGE_KEY = 'helpdesk_session_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota/permission errors
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A FormData body (file uploads) must NOT get an explicit Content-Type —
  // the browser sets one itself with the multipart boundary the server
  // needs to parse it. Everything else keeps going through as JSON.
  const isFormData = options.body instanceof FormData;
  const token = getStoredToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...authHeaders, ...options.headers }
      : {
          'Content-Type': 'application/json',
          ...authHeaders,
          ...options.headers,
        },
    ...options,
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      setStoredToken(null);
    }
    const message = (body as { error?: string } | null)?.error ?? res.statusText;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

function toBody(data: unknown): BodyInit | undefined {
  if (data instanceof FormData) return data;
  return data !== undefined ? JSON.stringify(data) : undefined;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: toBody(data) }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: toBody(data) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
