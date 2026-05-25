import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import { Check, Download, Loader2 } from "lucide-react";

interface ImageItem {
  url: string;
  filename?: string;
  label?: string;
  status?: "pending" | "approved";
}

interface ImageGridProps {
  images: ImageItem[];
  className?: string;
  onImageClick?: (index: number) => void;
  /** When true, each card shows a checkbox in the top-left corner */
  selectable?: boolean;
  /** Set of currently selected indices */
  selectedIndices?: Set<number>;
  /** Called when selection changes */
  onSelectionChange?: (indices: Set<number>) => void;
  /** Called with image index when the download button is clicked */
  onDownload?: (index: number) => void;
}

const cardVariants = {
  initial: { opacity: 0, y: 32, scale: 0.94 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.3, ease: "easeIn" as const },
  },
};

export function ImageGrid({
  images,
  className,
  onImageClick,
  selectable,
  selectedIndices,
  onSelectionChange,
  onDownload,
}: ImageGridProps) {
  if (images.length === 0) return null;

  const toggleSelection = (index: number) => {
    if (!selectable || !onSelectionChange) return;
    const next = new Set(selectedIndices ?? []);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    onSelectionChange(next);
  };

  return (
    <div
      className={cn(
        "columns-2 sm:columns-3 md:columns-4 gap-3",
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {images.map((img, i) => {
          const isPending = img.status === "pending";
          const isSelected = selectedIndices?.has(i) ?? false;
          return (
            <motion.div
              key={img.url}
              layout
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={cn(
                "break-inside-avoid mb-3",
                !isPending && "group cursor-pointer"
              )}
              onClick={() => {
                if (!isPending) onImageClick?.(i);
              }}
            >
              <div
                className={cn(
                  "glass rounded-xl overflow-hidden transition-all duration-300 relative",
                  !isPending &&
                    "group-hover:border-accent-500/30 group-hover:scale-[1.02]",
                  isPending && "animate-pulse-glow",
                  isSelected && "ring-2 ring-accent-500"
                )}
              >
                <img
                  src={img.url}
                  alt={img.label ?? `Image ${i + 1}`}
                  className={cn(
                    "w-full h-auto object-cover transition-all duration-500",
                    isPending && "opacity-50"
                  )}
                  loading="lazy"
                />
                {/* Pending overlay */}
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-surface-900/30 backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-accent-400" />
                      <span className="text-xs font-medium text-accent-400/80 tracking-wide">
                        Verifying...
                      </span>
                    </div>
                  </div>
                )}
                {/* Checkbox */}
                {selectable && !isPending && (
                  <div
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(i);
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border transition-all duration-200",
                        isSelected
                          ? "border-accent-500 bg-accent-500 text-white"
                          : "border-white/40 bg-black/30 text-transparent group-hover:border-white/70"
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                )}
                {/* Download button */}
                {!isPending && onDownload && (
                  <button
                    className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/70 opacity-0 transition-all duration-200 hover:bg-accent-500 hover:text-white group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(i);
                    }}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                {img.label && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-neutral-500 truncate">
                      {img.label}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
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
