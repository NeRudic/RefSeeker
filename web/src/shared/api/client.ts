const BASE = "/api";

export interface SessionResponse {
  session_id: string;
}

export interface SessionState {
  session_id: string;
  query_name: string;
  saved_count: number;
  max_images: number;
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

export async function createSession(
  query: string,
  maxImages: number
): Promise<SessionResponse> {
  const res = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_images: maxImages }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSession(
  sessionId: string
): Promise<SessionState> {
  const res = await fetch(`${BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Session not found");
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
  const res = await fetch(`${BASE}/collections`);
  if (!res.ok) throw new Error("Failed to list collections");
  return res.json();
}

export async function getCollection(
  name: string
): Promise<CollectionDetail> {
  const res = await fetch(`${BASE}/collections/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error("Collection not found");
  return res.json();
}

export async function deleteCollection(
  name: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/collections/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error("Failed to delete collection");
}

export interface BlacklistResponse {
  items: string[];
}

export async function getBlacklist(): Promise<BlacklistResponse> {
  const res = await fetch(`${BASE}/settings/blacklist`);
  if (!res.ok) throw new Error("Failed to fetch blacklist");
  return res.json();
}

export async function updateBlacklist(
  items: string[]
): Promise<BlacklistResponse> {
  const res = await fetch(`${BASE}/settings/blacklist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error("Failed to update blacklist");
  return res.json();
}
