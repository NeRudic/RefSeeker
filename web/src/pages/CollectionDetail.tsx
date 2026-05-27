import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api/client";
import { ImageCard } from "../components/ImageCard";
import { ImageModal } from "../components/ImageModal";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../hooks/useAuth";
import {
  Loader2,
  ArrowLeft,
  Download,
  Trash2,
  Image,
  AlertTriangle,
} from "lucide-react";

interface ImageInfo {
  filename: string;
  path: string;
  size: number;
}

export function CollectionDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [modalName, setModalName] = useState("");
  const [downloading, setDownloading] = useState(false);

  const loadImages = () => {
    if (!name) return;
    setLoading(true);
    apiGet<{ name: string; images: ImageInfo[] }>(`/collections/${name}`)
      .then((data) => setImages(data.images))
      .catch(() => setError("Failed to load collection"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadImages();
  }, [name]);

  const handleDelete = async () => {
    if (!name) return;
    if (!window.confirm("Delete this entire collection? This cannot be undone.")) return;
    try {
      await apiDelete(`/collections/${name}`);
      navigate("/collections");
    } catch {
      setError("Failed to delete collection");
    }
  };

  const handleDownloadAll = async () => {
    if (!name || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/collections/${name}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [] }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }

  if (error && images.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate("/collections")} className="ghost-button !p-2 mb-4">
          <ArrowLeft size={18} />
        </button>
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Error"
          description={error}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate("/collections")} className="ghost-button !p-2">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-100">{name}</h1>
          <p className="text-sm text-zinc-500">{images.length} images</p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={downloading || images.length === 0}
          className="ghost-button flex items-center gap-2"
        >
          <Download size={16} />
          Download All
        </button>
        <button onClick={handleDelete} className="ghost-button flex items-center gap-2 !text-red-400 hover:!text-red-300">
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      {images.length === 0 ? (
        <EmptyState
          icon={<Image size={24} />}
          title="Empty collection"
          description="No images in this collection."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => (
            <ImageCard
              key={img.filename}
              filename={img.filename}
              path={img.path}
              size={img.size}
              onClick={() => { setModalSrc(img.path); setModalName(img.filename); }}
            />
          ))}
        </div>
      )}

      <ImageModal
        src={modalSrc || ""}
        alt={modalName}
        open={!!modalSrc}
        onClose={() => setModalSrc(null)}
      />
    </div>
  );
}
