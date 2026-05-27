import { useNavigate } from "react-router-dom";
import { FolderOpen, Image } from "lucide-react";

interface CollectionCardProps {
  name: string;
  imageCount: number;
  thumbnail: string | null;
}

export function CollectionCard({ name, imageCount, thumbnail }: CollectionCardProps) {
  const navigate = useNavigate();
  const displayName = name.length > 40 ? name.slice(0, 37) + "..." : name;

  return (
    <button
      onClick={() => navigate(`/collections/${name}`)}
      className="glass-card-hover overflow-hidden text-left group"
    >
      <div className="aspect-[4/3] bg-obsidian-850 flex items-center justify-center overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <Image size={36} className="text-zinc-600" />
        )}
      </div>
      <div className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-zinc-200 truncate">{displayName}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {imageCount} image{imageCount !== 1 ? "s" : ""}
          </p>
        </div>
        <FolderOpen size={16} className="text-zinc-600 shrink-0 ml-3" />
      </div>
    </button>
  );
}
