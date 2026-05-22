import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCollection, deleteCollection } from "@/shared/api/client";
import { ImageGrid } from "@/widgets/image-grid/image-grid";
import { Lightbox } from "@/widgets/lightbox/lightbox";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  AlertCircle,
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

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="glass rounded-2xl p-12 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-neutral-400">Collection not found</p>
          <Link
            to="/gallery"
            className="text-sm text-accent-400 hover:text-accent-300 mt-2 inline-block"
          >
            Back to gallery
          </Link>
        </div>
      </div>
    );
  }

  const images = data.images.map((img) => ({
    url: img.path,
    label: img.filename,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Gallery
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">{decoded}</h1>
            <Badge variant="default" className="mt-2">
              {data.images.length}{" "}
              {data.images.length === 1 ? "image" : "images"}
            </Badge>
          </div>

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
              <div className="absolute right-0 top-full mt-2 glass rounded-xl p-4 w-64 z-10 animate-fade-in">
                <p className="text-sm text-neutral-300 mb-3">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-neutral-600">This collection is empty</p>
        </div>
      ) : (
        <ImageGrid
          images={images}
          onImageClick={(idx) => setLightboxIndex(idx)}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
