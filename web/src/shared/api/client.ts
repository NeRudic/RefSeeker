const BASE = "/api";

export interface SessionResponse {
  session_id: string;
}

export interface SessionState {
  session_id: string;
  query_name: string;
  saved_count: number;
  max_images: number;
  blacklist: string[];
  download_attempts: number;
  gpt_calls: number;
  elapsed: number;
  filter_stats: Record<string, number>;
  finished: boolean;
}

export interface CollectionSummary {
  name: string;
  path: string;
  image_count: number;
  thumbnail: string | null;
}

export interface CollectionsResponse {
  collections: CollectionSummary[];
}

export interface ImageInfo {
  filename: string;
  path: string;
  size: number;
}

export interface CollectionDetail {
  name: string;
  images: ImageInfo[];
}

export interface PipelineEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface BlacklistResponse {
  items: string[];
}

export class ApiError extends Error {
  status: number;
  rateLimit?: { limit: number; used: number; remaining: number; reset_at: string };

  constructor(message: string, status: number, rateLimit?: ApiError["rateLimit"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

// ── Auth-aware fetch wrapper ────────────────────────────────────────────

let _refreshPromise: Promise<boolean> | null = null;

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = localStorage.getItem("access_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  // On 401, attempt token refresh
  if (res.status === 401 && token) {
    if (!_refreshPromise) {
      _refreshPromise = _attemptRefresh();
    }
    const refreshed = await _refreshPromise;
    _refreshPromise = null;

    if (refreshed) {
      const newToken = localStorage.getItem("access_token");
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.dispatchEvent(new Event("auth:logout"));
    }
  }

  if (!res.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = await res.json();
    } catch {
      // ignore parse errors
    }
    const detail = typeof body.detail === "string" ? body.detail : `Request failed with status ${res.status}`;
    const rateLimit = body.limit !== undefined
      ? { limit: body.limit as number, used: body.used as number, remaining: body.remaining as number, reset_at: body.reset_at as string }
      : undefined;
    throw new ApiError(detail, res.status, rateLimit);
  }

  return res;
}

async function _attemptRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── API functions ───────────────────────────────────────────────────────

export async function createSession(
  query: string,
  maxImages: number,
  blacklist?: string[]
): Promise<SessionResponse> {
  const res = await apiFetch("/sessions", {
    method: "POST",
    body: JSON.stringify({ query, max_images: maxImages, blacklist: blacklist ?? [] }),
  });
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await apiFetch(`/sessions/${sessionId}`);
  return res.json();
}

export function subscribeToSession(
  sessionId: string,
  onEvent: (event: PipelineEvent) => void,
  onError?: (err: Error) => void
): () => void {
  const es = new EventSource(`${BASE}/sessions/${sessionId}/stream`);

  es.onmessage = (msg) => {
    try {
      const event: PipelineEvent = JSON.parse(msg.data);
      onEvent(event);
    } catch {
      // keepalive comments or malformed data
    }
  };

  es.onerror = () => {
    es.close();
    onError?.(new Error("SSE connection failed"));
  };

  return () => es.close();
}

export async function listCollections(): Promise<CollectionsResponse> {
  const res = await apiFetch("/collections");
  return res.json();
}

export async function getCollection(name: string): Promise<CollectionDetail> {
  const res = await apiFetch(`/collections/${encodeURIComponent(name)}`);
  return res.json();
}

export async function deleteCollection(name: string): Promise<void> {
  await apiFetch(`/collections/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function getBlacklist(): Promise<BlacklistResponse> {
  const res = await apiFetch("/settings/blacklist");
  return res.json();
}

export async function updateBlacklist(items: string[]): Promise<BlacklistResponse> {
  const res = await apiFetch("/settings/blacklist", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  return res.json();
}
