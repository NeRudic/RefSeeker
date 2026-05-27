import { useEffect, useState } from "react";
import { FolderOpen, Loader2, AlertTriangle } from "lucide-react";
import { apiGet } from "../api/client";
import { CollectionCard } from "../components/CollectionCard";
import { EmptyState } from "../components/EmptyState";

interface Collection {
  name: string;
  path: string;
  image_count: number;
  thumbnail: string | null;
}

export function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ collections: Collection[] }>("/collections")
      .then((data) => setCollections(data.collections))
      .catch(() => setError("Failed to load collections"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-accent-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Failed to load"
        description={error}
      />
    );
  }

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={<FolderOpen size={24} />}
        title="No collections yet"
        description="Run your first search to start building a reference image collection."
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Collections</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((c) => (
          <CollectionCard key={c.name} name={c.name} imageCount={c.image_count} thumbnail={c.thumbnail} />
        ))}
      </div>
    </div>
  );
}
