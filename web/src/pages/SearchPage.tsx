import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  PipelineTimeline,
  EventLog,
  type PipelineState,
} from "@/widgets/pipeline-timeline/pipeline-timeline";
import { ImageGrid } from "@/widgets/image-grid/image-grid";
import { Lightbox } from "@/widgets/lightbox/lightbox";
import {
  subscribeToSession,
  getSession,
  type PipelineEvent,
} from "@/shared/api/client";
import { Badge } from "@/shared/ui/badge";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export function SearchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pipeline, setPipeline] = useState<PipelineState>({
    search: "idle",
    download: "idle",
    verify: "idle",
  });
  const [approvedUrls, setApprovedUrls] = useState<string[]>([]);
  const [logEvents, setLogEvents] = useState<
    { type: "approved" | "rejected" | "info"; message: string; timestamp: number }[]
  >([]);
  const [sessionState, setSessionState] = useState<{
    query?: string;
    saved?: number;
    max?: number;
  }>({});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial session state
  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }

    getSession(sessionId)
      .then((s) => {
        setSessionState({ query: s.query_name, saved: s.saved_count, max: s.max_images });
        if (s.finished) {
          setFinished(true);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [sessionId, navigate]);

  // Subscribe to SSE
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToSession(
      sessionId,
      (event: PipelineEvent) => {
        handleEvent(event);
      },
      () => setError("Connection lost — refreshing...")
    );

    return unsubscribe;
  }, [sessionId]);

  const handleEvent = useCallback((event: PipelineEvent) => {
    const { type, data } = event;

    switch (type) {
      case "search.started":
        setPipeline((p) => ({ ...p, search: "active" }));
        setSessionState((s) => ({ ...s, query: data.query as string }));
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Searching for "${data.query}"...`, timestamp: Date.now() },
        ]);
        break;

      case "search.complete":
        setPipeline((p) => ({ ...p, search: "done" }));
        setLogEvents((prev) => [
          ...prev,
          {
            type: "info",
            message: `Found ${data.unique} unique URLs (${data.after_filter} after pre-filter)`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "download.started":
        setPipeline((p) => ({ ...p, download: "active" }));
        setLogEvents((prev) => [
          ...prev,
          {
            type: "info",
            message: `Downloading ${data.total} images...`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "download.complete":
        setPipeline((p) => ({ ...p, download: "done" }));
        setLogEvents((prev) => [
          ...prev,
          {
            type: "info",
            message: `Downloaded ${data.downloaded} valid images`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "verification.batch_started":
        setPipeline((p) => ({ ...p, verify: "active" }));
        setLogEvents((prev) => [
          ...prev,
          {
            type: "info",
            message: `Verifying batch ${data.batch}/${data.total} (${data.size} images)...`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "verification.batch_complete":
        setLogEvents((prev) => [
          ...prev,
          {
            type: "info",
            message: `Batch ${data.batch}/${data.total} verified`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "image.approved":
        setApprovedUrls((prev) => [
          ...prev,
          `/api/collections/${encodeURIComponent(String(data.url).split("/").pop() ?? "")}/images/${data.saved}`,
        ]);
        setSessionState((s) => ({
          ...s,
          saved: data.saved as number,
          max: data.max as number,
        }));
        setLogEvents((prev) => [
          ...prev,
          {
            type: "approved",
            message: `${(data.reason as string) || "Approved"}`,
            timestamp: Date.now(),
          },
        ]);
        break;

      case "image.rejected":
        setLogEvents((prev) => [
          ...prev,
          { type: "rejected", message: `${(data.reason as string) || "Rejected"} (${data.filter})`, timestamp: Date.now() },
        ]);
        break;

      case "session.complete":
        setPipeline((p) => ({ ...p, verify: "done" }));
        setFinished(true);
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Session complete — ${(data.metrics as Record<string, unknown>)?.saved ?? 0} images saved`, timestamp: Date.now() },
        ]);
        break;

      case "session.error":
        setError(data.message as string);
        setFinished(true);
        break;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New search
        </Link>
        <h1 className="text-2xl font-bold text-neutral-100">
          {sessionState.query ?? "Searching..."}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={finished ? "success" : "info"}>
            {finished ? "Complete" : "In progress"}
          </Badge>
          {sessionState.saved !== undefined && (
            <Badge variant="success">
              {sessionState.saved} {sessionState.saved === 1 ? "image" : "images"} saved
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 glass rounded-xl p-4 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Pipeline Timeline */}
      <PipelineTimeline state={pipeline} className="mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Event log sidebar */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Activity Log
            </h3>
            {logEvents.length === 0 ? (
              <p className="text-xs text-neutral-600">Waiting for events...</p>
            ) : (
              <EventLog events={logEvents} />
            )}
          </div>
        </div>

        {/* Approved images */}
        <div className="lg:col-span-3">
          <h2 className="text-sm font-medium text-neutral-300 mb-4">
            Approved Images ({approvedUrls.length})
          </h2>
          {approvedUrls.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-neutral-600">
                {finished
                  ? "No images were approved"
                  : "Waiting for images to be approved..."}
              </p>
            </div>
          ) : (
            <ImageGrid
              images={approvedUrls.map((url, i) => ({
                url,
                label: `#${i + 1}`,
              }))}
              onImageClick={(idx) => setLightboxIndex(idx)}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={approvedUrls.map((url, i) => ({
            url,
            label: `Approved image #${i + 1}`,
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
