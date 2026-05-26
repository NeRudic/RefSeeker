import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ImageModal } from "../components/ImageModal";
import {
  Loader2,
  Image,
  Download,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

interface ApprovedImage {
  url: string;
  path: string;
  reason: string;
}

interface SessionMetrics {
  saved: number;
  max: number;
  downloads: number;
  gpt_calls: number;
  elapsed: number;
  filters: Record<string, number>;
}

type SessionStatus = "connecting" | "running" | "complete" | "error";

export function Session() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SessionStatus>("connecting");
  const [approvedImages, setApprovedImages] = useState<ApprovedImage[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [downloadCurrent, setDownloadCurrent] = useState(0);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [error, setError] = useState("");
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [modalName, setModalName] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!id) return;

    const es = new EventSource(`/api/sessions/${id}/stream`);
    eventSourceRef.current = es;
    let finished = false;

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        switch (event.type) {
          case "search.started":
            setStatus("running");
            break;
          case "download.progress":
            setDownloadTotal(event.data.total);
            setDownloadCurrent(event.data.current);
            break;
          case "image.approved":
            setApprovedImages((prev) => [
              ...prev,
              { url: event.data.url, path: event.data.path, reason: event.data.reason },
            ]);
            break;
          case "image.rejected":
            setRejectedCount((c) => c + 1);
            break;
          case "session.complete":
            finished = true;
            setStatus("complete");
            setMetrics(event.data.metrics);
            es.close();
            break;
          case "session.error":
            finished = true;
            setStatus("error");
            setError(event.data.message || "Session failed");
            es.close();
            break;
        }
      } catch {
        // keepalive comment, ignore
      }
    };

    es.onerror = () => {
      if (!finished) {
        setStatus("error");
        setError("Failed to connect to session stream");
      }
    };

    return () => {
      es.close();
    };
  }, [id]);

  const totalProgress = downloadTotal > 0 ? (downloadCurrent / downloadTotal) * 100 : 0;
  const savedCount = metrics?.saved ?? approvedImages.length;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate("/")} className="ghost-button !p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Session</h1>
          <p className="text-sm text-zinc-500 font-mono">{id?.slice(0, 8)}...</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Error state */}
      {status === "error" && (
        <div className="glass-card border-red-500/25 p-8 text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-zinc-200 mb-2">Session Failed</h2>
          <p className="text-sm text-zinc-400 mb-4">{error}</p>
          <button onClick={() => navigate("/")} className="accent-button">
            Try Again
          </button>
        </div>
      )}

      {/* Connecting */}
      {status === "connecting" && (
        <div className="glass-card p-12 text-center">
          <Loader2 size={40} className="text-accent-400 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Connecting to session...</p>
        </div>
      )}

      {/* Progress bar (running) */}
      {status === "running" && (
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-400">
              Downloading images: {downloadCurrent}/{downloadTotal}
            </span>
            <span className="text-sm font-mono text-accent-400">{Math.round(totalProgress)}%</span>
          </div>
          <div className="w-full h-2 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-gradient-h rounded-full transition-all duration-500 ease-out"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-4 text-xs text-zinc-500">
            <span>{approvedImages.length} approved</span>
            <span>{rejectedCount} rejected</span>
          </div>
        </div>
      )}

      {/* Metrics (complete) */}
      {status === "complete" && metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Saved", value: `${metrics.saved}/${metrics.max}` },
            { label: "Downloads", value: metrics.downloads },
            { label: "AI Calls", value: metrics.gpt_calls },
            { label: "Time", value: `${Math.round(metrics.elapsed)}s` },
          ].map(({ label, value }) => (
            <div key={label} className="glass-card p-4 text-center">
              <div className="text-lg font-bold text-zinc-100">{value}</div>
              <div className="text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Approved images grid */}
      {approvedImages.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-200">
              Approved Images ({approvedImages.length})
            </h2>
            {status === "complete" && (
              <span className="text-xs text-zinc-500">
                Filtered: {Object.entries(metrics?.filters || {}).map(([k, v]) => `${k}=${v}`).join(", ")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {approvedImages.map((img, i) => (
              <div
                key={i}
                className="glass-card-hover overflow-hidden cursor-pointer animate-slide-up"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                onClick={() => { setModalSrc(img.path); setModalName(`Image ${i + 1}`); }}
              >
                <div className="aspect-square bg-obsidian-850 overflow-hidden">
                  <img
                    src={img.path}
                    alt={img.reason}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400 truncate">{img.reason}</span>
                  <a
                    href={`${img.path}?download=1`}
                    onClick={(e) => e.stopPropagation()}
                    className="w-6 h-6 rounded-md bg-obsidian-750 border border-obsidian-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0 ml-2"
                  >
                    <Download size={11} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : status === "complete" ? (
        <EmptyState
          icon={<Image size={24} />}
          title="No approved images"
          description="All downloaded images were rejected by the AI verification pipeline."
          action={
            <button onClick={() => navigate("/")} className="accent-button">
              New Search
            </button>
          }
        />
      ) : null}

      <ImageModal
        src={modalSrc || ""}
        alt={modalName}
        open={!!modalSrc}
        onClose={() => setModalSrc(null)}
      />
    </div>
  );
}
