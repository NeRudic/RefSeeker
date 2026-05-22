import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CollectionGrid } from "@/widgets/image-grid/image-grid";
import { listCollections } from "@/shared/api/client";
import { Loader2 } from "lucide-react";

export function GalleryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-red-400">Failed to load collections</p>
        </div>
      </div>
    );
  }

  const collections = (data?.collections ?? []).map((c) => ({
    name: c.name,
    imageCount: c.image_count,
    thumbnail: c.thumbnail,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-100">Collections</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Browse all your saved reference image collections
        </p>
      </div>

      <CollectionGrid
        collections={collections}
        onSelect={(name) => navigate(`/gallery/${encodeURIComponent(name)}`)}
      />
    </div>
  );
}
