import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
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
  downloadCollection,
  getImageDownloadUrl,
  type PipelineEvent,
} from "@/shared/api/client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Timer,
  X,
} from "lucide-react";

interface TrackedImage {
  id: string;
  displayUrl: string;
  filename: string;
  label: string;
}

export function SearchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pipeline, setPipeline] = useState<PipelineState>({
    search: "idle",
    download: "idle",
    verify: "idle",
  });
  const [images, setImages] = useState<TrackedImage[]>([]);
  const [logEvents, setLogEvents] = useState<
    { type: "approved" | "rejected" | "info"; message: string; timestamp: number }[]
  >([]);
  const [sessionState, setSessionState] = useState<{
    query?: string;
    saved?: number;
    max?: number;
    blacklist?: string[];
  }>({});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const finishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current!) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current) {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      navigate("/");
      return;
    }

    getSession(sessionId)
      .then((s) => {
        setSessionState({ query: s.query_name, saved: s.saved_count, max: s.max_images, blacklist: s.blacklist });
        if (s.finished) {
          setFinished(true);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = subscribeToSession(
      sessionId,
      (event: PipelineEvent) => {
        handleEvent(event);
      },
      () => {
        if (!finishedRef.current) {
          setError("Connection lost — refreshing...");
        }
      },
    );

    return unsubscribe;
  }, [sessionId]);

  const handleEvent = useCallback((event: PipelineEvent) => {
    const { type, data } = event;

    switch (type) {
      case "search.started":
        setPipeline((p) => ({ ...p, search: "active" }));
        setSessionState((s) => ({ ...s, query: data.query as string }));
        startTimer();
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
          { type: "info", message: `Downloading ${data.total} images...`, timestamp: Date.now() },
        ]);
        break;

      case "download.complete":
        setPipeline((p) => ({ ...p, download: "done" }));
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Downloaded ${data.downloaded} valid images`, timestamp: Date.now() },
        ]);
        break;

      case "verification.batch_started":
        setPipeline((p) => ({ ...p, verify: "active" }));
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Verifying batch ${data.batch}/${data.total} (${data.size} images)...`, timestamp: Date.now() },
        ]);
        break;

      case "verification.batch_complete":
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Batch ${data.batch}/${data.total} verified`, timestamp: Date.now() },
        ]);
        break;

      case "image.approved":
        setImages((prev) => [
          ...prev,
          {
            id: data.url as string,
            displayUrl: data.path as string,
            filename: ((data.path as string).split("/").pop() ?? "") as string,
            label: `#${prev.length + 1}`,
          },
        ]);
        setSessionState((s) => ({ ...s, saved: data.saved as number, max: data.max as number }));
        setLogEvents((prev) => [
          ...prev,
          { type: "approved", message: `${(data.reason as string) || "Approved"}`, timestamp: Date.now() },
        ]);
        break;

      case "session.complete":
        setPipeline((p) => ({ ...p, verify: "done" }));
        setFinished(true);
        finishedRef.current = true;
        stopTimer();
        setLogEvents((prev) => [
          ...prev,
          { type: "info", message: `Session complete — ${(data.metrics as Record<string, unknown>)?.saved ?? 0} images saved`, timestamp: Date.now() },
        ]);
        break;

      case "session.error":
        setError(data.message as string);
        setFinished(true);
        finishedRef.current = true;
        stopTimer();
        break;
    }
  }, []);

  const collectionName = sessionState.query ?? "";

  const handleDownloadOne = useCallback(
    (index: number) => {
      const img = images[index];
      if (!img || !collectionName) return;
      const url = getImageDownloadUrl(collectionName, img.filename);
      const a = document.createElement("a");
      a.href = url;
      a.download = img.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [images, collectionName],
  );

  const handleDownloadSelected = useCallback(async () => {
    if (selectedIndices.size === 0 || !collectionName) return;
    const files = Array.from(selectedIndices).map((i) => images[i]?.filename).filter(Boolean) as string[];
    try { await downloadCollection(collectionName, files); } catch { /* silent */ }
  }, [selectedIndices, images, collectionName]);

  const handleDownloadAll = useCallback(async () => {
    if (!collectionName) return;
    const files = images.map((img) => img.filename).filter(Boolean) as string[];
    try { await downloadCollection(collectionName, files); } catch { /* silent */ }
  }, [images, collectionName]);

  useEffect(() => {
    setSelectedIndices(new Set());
  }, [images.length]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New search
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          {sessionState.query ?? "Searching..."}
        </h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant={finished ? "success" : "accent"}>
            {finished ? "Complete" : "In progress"}
          </Badge>
          {sessionState.saved !== undefined && (
            <Badge variant="success">
              {sessionState.saved} {sessionState.saved === 1 ? "image" : "images"} saved
            </Badge>
          )}
          {elapsed > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted ml-1">
              <Timer className="h-3.5 w-3.5" />
              <span className="font-mono tabular-nums">
                {elapsed >= 3600
                  ? `${Math.floor(elapsed / 3600)}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
                  : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`}
              </span>
            </div>
          )}
          {collectionName && images.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleDownloadAll} className="ml-auto">
              <Download className="h-3.5 w-3.5" />
              Download all
            </Button>
          )}
          {sessionState.blacklist && sessionState.blacklist.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-400/80 ml-1">
              <AlertTriangle className="h-3 w-3" />
              <span className="hidden sm:inline">Blacklist:</span>
              {sessionState.blacklist.map((item, i) => (
                <span key={i} className="rounded-md bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5 text-[10px]">
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 glass rounded-xl p-4 border border-red-500/15 flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Pipeline */}
      <PipelineTimeline state={pipeline} className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Event log sidebar */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl p-4 sticky top-20">
            <h3 className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-3">
              Activity Log
            </h3>
            {logEvents.length === 0 ? (
              <p className="text-xs text-text-muted/50">Waiting for events...</p>
            ) : (
              <EventLog events={logEvents} />
            )}
          </div>
        </div>

        {/* Images grid */}
        <div className="lg:col-span-3">
          <h2 className="text-sm font-medium text-text-secondary mb-4">
            Images ({images.length})
          </h2>
          {images.length === 0 ? (
            <div className="glass rounded-2xl p-16 text-center">
              <p className="text-text-muted text-sm">
                {finished
                  ? "No images were saved"
                  : pipeline.verify === "active"
                    ? "Verifying images..."
                    : "Waiting for images..."}
              </p>
            </div>
          ) : (
            <ImageGrid
              images={images.map((img) => ({
                url: img.displayUrl,
                status: "approved" as const,
                label: img.label,
                filename: img.filename,
              }))}
              onImageClick={(idx) => setLightboxIndex(idx)}
              selectable
              selectedIndices={selectedIndices}
              onSelectionChange={setSelectedIndices}
              onDownload={handleDownloadOne}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images.map((img, i) => ({
            url: img.displayUrl,
            label: `#${i + 1}`,
            filename: img.filename,
          }))}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDownload={handleDownloadOne}
        />
      )}

      {/* Floating selection bar */}
      {selectedIndices.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 shadow-xl border border-accent-500/15">
            <span className="text-sm text-text-primary">
              {selectedIndices.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleDownloadSelected}>
                <Download className="h-3.5 w-3.5" />
                Download selected
              </Button>
              <button
                onClick={() => setSelectedIndices(new Set())}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
