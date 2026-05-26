import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CollectionGrid } from "@/widgets/image-grid/image-grid";
import { listCollections } from "@/shared/api/client";
import { Image, Loader2 } from "lucide-react";

export function GalleryPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-red-400 text-sm">Failed to load collections</p>
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-500/10">
            <Image className="h-4 w-4 text-accent-400" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Collections</h1>
        </div>
        <p className="text-sm text-text-muted mt-1 ml-11">
          Browse all your saved reference image collections
        </p>
      </motion.div>

      <CollectionGrid
        collections={collections}
        onSelect={(name) => navigate(`/gallery/${encodeURIComponent(name)}`)}
      />
    </div>
  );
}
