export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // A FormData body (file uploads) must NOT get an explicit Content-Type —
  // the browser sets one itself with the multipart boundary the server
  // needs to parse it. Everything else keeps going through as JSON.
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...options.headers }
      : {
          'Content-Type': 'application/json',
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
