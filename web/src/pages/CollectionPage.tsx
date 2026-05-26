import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getCollection, deleteCollection, downloadCollection, getImageDownloadUrl } from "@/shared/api/client";
import { ImageGrid } from "@/widgets/image-grid/image-grid";
import { Lightbox } from "@/widgets/lightbox/lightbox";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  ArrowLeft,
  Download,
  Loader2,
  Trash2,
  AlertCircle,
  X,
} from "lucide-react";

export function CollectionPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const decoded = name ? decodeURIComponent(name) : "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["collection", decoded],
    queryFn: () => getCollection(decoded),
    enabled: !!decoded,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCollection(decoded),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      navigate("/gallery");
    },
  });

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const images = (data?.images ?? []).map((img) => ({
    url: img.path,
    label: img.filename,
    filename: img.filename,
  }));

  const handleDownloadOne = (index: number) => {
    const img = images[index];
    if (!img) return;
    const url = getImageDownloadUrl(decoded, img.filename);
    const a = document.createElement("a");
    a.href = url;
    a.download = img.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSelected = async () => {
    const files = Array.from(selectedIndices).map((i) => images[i]?.filename).filter(Boolean);
    try { await downloadCollection(decoded, files); } catch { /* silent */ }
  };

  const handleDownloadAll = async () => {
    const files = images.map((img) => img.filename).filter(Boolean);
    try { await downloadCollection(decoded, files); } catch { /* silent */ }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="glass rounded-2xl p-12 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-text-secondary">Collection not found</p>
          <Link to="/gallery" className="text-sm text-accent-400 hover:text-accent-300 mt-2 inline-block">
            Back to gallery
          </Link>
        </div>
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
          to="/gallery"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Gallery
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{decoded}</h1>
            <Badge variant="default" className="mt-2">
              {data.images.length} {data.images.length === 1 ? "image" : "images"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownloadAll}>
              <Download className="h-3.5 w-3.5" />
              Download all
            </Button>
            <div className="relative">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>

              {showDeleteConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute right-0 top-full mt-2 glass rounded-xl p-4 w-64 z-10"
                >
                  <p className="text-sm text-text-primary mb-3">
                    Delete "{decoded}" and all its images?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                      className="flex-1"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Delete"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center">
          <p className="text-text-muted text-sm">This collection is empty</p>
        </div>
      ) : (
        <ImageGrid
          images={images}
          onImageClick={(idx) => setLightboxIndex(idx)}
          selectable
          selectedIndices={selectedIndices}
          onSelectionChange={setSelectedIndices}
          onDownload={handleDownloadOne}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
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
