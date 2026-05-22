import { cn } from "@/shared/lib/cn";

interface ImageItem {
  url: string;
  filename?: string;
  label?: string;
}

interface ImageGridProps {
  images: ImageItem[];
  className?: string;
  onImageClick?: (index: number) => void;
}

export function ImageGrid({ images, className, onImageClick }: ImageGridProps) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "columns-2 sm:columns-3 md:columns-4 gap-3",
        className
      )}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className="break-inside-avoid mb-3 group cursor-pointer"
          style={{ animationDelay: `${(i % 12) * 50}ms` }}
          onClick={() => onImageClick?.(i)}
        >
          <div className="glass rounded-xl overflow-hidden transition-all duration-300 group-hover:border-accent-500/30 group-hover:scale-[1.02]">
            <img
              src={img.url}
              alt={img.label ?? `Image ${i + 1}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
            {img.label && (
              <div className="px-3 py-2">
                <p className="text-xs text-neutral-500 truncate">{img.label}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Masonry-like collection cards ────────────────────────────────────────

interface CollectionCard {
  name: string;
  imageCount: number;
  thumbnail: string | null;
}

interface CollectionGridProps {
  collections: CollectionCard[];
  className?: string;
  onSelect: (name: string) => void;
}

export function CollectionGrid({
  collections,
  className,
  onSelect,
}: CollectionGridProps) {
  if (collections.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-600">No collections yet</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {collections.map((col) => (
        <button
          key={col.name}
          onClick={() => onSelect(col.name)}
          className="glass rounded-2xl overflow-hidden text-left group cursor-pointer transition-all duration-300 hover:border-accent-500/30 hover:scale-[1.02]"
        >
          <div className="aspect-[16/10] bg-surface-800 overflow-hidden">
            {col.thumbnail ? (
              <img
                src={col.thumbnail}
                alt={col.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                <span className="text-4xl font-light">∅</span>
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-sm font-medium text-neutral-200 truncate">
              {col.name}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {col.imageCount} {col.imageCount === 1 ? "image" : "images"}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
