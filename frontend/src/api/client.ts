import type { paths } from "./schema";

export type ApiPath = keyof paths;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const LEGACY_ACCESS_TOKEN_KEY = "techtrack.access";
const LEGACY_REFRESH_TOKEN_KEY = "techtrack.refresh";
export const AUTH_EXPIRED_EVENT = "techtrack:auth-expired";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.data = data;
  }
}

let accessToken: string | null = null;

export const accessTokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

export function clearLegacyTokenStorage() {
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  retry?: boolean;
};

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();
  return response.text();
}

let refreshPromise: Promise<boolean> | null = null;

async function performRefresh() {
  const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    accessTokenStore.clear();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    return false;
  }

  const data = (await response.json()) as { access?: unknown };
  if (typeof data.access !== "string" || !data.access) {
    accessTokenStore.clear();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    return false;
  }

  accessTokenStore.set(data.access);
  return true;
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function restoreAccessToken() {
  if (accessTokenStore.get()) return true;
  return refreshAccessToken();
}

function authHeaders(headersInit?: HeadersInit) {
  const headers = new Headers(headersInit);
  const token = accessTokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  if (!options.skipAuth) {
    const token = accessTokenStore.get();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? "same-origin",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.retry !== false && !options.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, { ...options, retry: false });
  }

  const data = await parseResponse(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export async function apiDownload(
  path: string,
  options: Omit<RequestOptions, "skipAuth"> = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const request = async (retry: boolean): Promise<Response> => {
    const headers = authHeaders(options.headers);
    if (options.body !== undefined)
      headers.set("Content-Type", "application/json");
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: options.credentials ?? "same-origin",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (response.status === 401 && retry) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return request(false);
    }
    return response;
  };

  const response = await request(options.retry !== false);
  if (!response.ok) {
    const data = await parseResponse(response);
    throw new ApiError(response.status, data);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return { blob: await response.blob(), filename: match?.[1] ?? null };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}
