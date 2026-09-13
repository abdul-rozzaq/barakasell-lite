const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://baraka-api.solara.uz/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("barakasell_admin_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem("barakasell_admin_token", token);
  else window.localStorage.removeItem("barakasell_admin_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = body?.message ?? `So'rov xato: ${res.status}`;
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown, extraHeaders?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined, headers: extraHeaders }),
  patch: <T>(path: string, data?: unknown, extraHeaders?: Record<string, string>) =>
    request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
      headers: extraHeaders,
    }),
  delete: <T>(path: string, extraHeaders?: Record<string, string>) =>
    request<T>(path, { method: "DELETE", headers: extraHeaders }),
};
