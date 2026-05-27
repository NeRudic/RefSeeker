import { Download } from "lucide-react";

interface ImageCardProps {
  filename: string;
  path: string;
  size: number;
  onClick: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageCard({ filename, path, size, onClick }: ImageCardProps) {
  return (
    <div className="glass-card-hover overflow-hidden group cursor-pointer" onClick={onClick}>
      <div className="aspect-square bg-obsidian-850 overflow-hidden">
        <img
          src={path}
          alt={filename}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-300 truncate">{filename}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{formatSize(size)}</p>
        </div>
        <a
          href={`${path}?download=1`}
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg bg-obsidian-750 border border-obsidian-700 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:border-obsidian-600 transition-all opacity-0 group-hover:opacity-100"
        >
          <Download size={13} />
        </a>
      </div>
    </div>
  );
}
