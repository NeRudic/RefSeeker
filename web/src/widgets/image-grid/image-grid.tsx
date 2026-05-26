import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/shared/lib/cn";
import { Check, Download, Loader2, ImageIcon } from "lucide-react";

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
  selectable?: boolean;
  selectedIndices?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
  onDownload?: (index: number) => void;
}

const cardVariants = {
  initial: { opacity: 0, y: 20, scale: 0.96 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.2, ease: "easeIn" as const },
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
    <div className={cn("columns-2 sm:columns-3 md:columns-4 gap-3", className)}>
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
                  "rounded-xl overflow-hidden transition-all duration-300 relative border border-border",
                  !isPending &&
                    "group-hover:border-accent-500/20 group-hover:translate-y-[-2px] group-hover:shadow-lg group-hover:shadow-accent-500/5",
                  isPending && "glass animate-shimmer",
                  isSelected && "ring-2 ring-accent-500 border-transparent"
                )}
              >
                <img
                  src={img.url}
                  alt={img.label ?? `Image ${i + 1}`}
                  className={cn(
                    "w-full h-auto object-cover transition-all duration-500",
                    isPending && "opacity-40"
                  )}
                  loading="lazy"
                />

                {/* Pending overlay */}
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-accent-400" />
                      <span className="text-[11px] font-medium text-accent-400/80">
                        Verifying
                      </span>
                    </div>
                  </div>
                )}

                {/* Selection checkbox */}
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
                        "flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-200",
                        isSelected
                          ? "bg-accent-500 border-accent-500 text-white"
                          : "border-white/30 bg-black/40 text-transparent group-hover:border-white/60"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                )}

                {/* Download button */}
                {!isPending && onDownload && (
                  <button
                    className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/60 opacity-0 transition-all duration-200 hover:bg-accent-500 hover:text-white group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(i);
                    }}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Label bar */}
                {img.label && !isPending && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <p className="text-[11px] text-white/80 truncate">
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

// ── Collection cards ───────────────────────────────────────────────────────

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
      <div className="text-center py-24">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03] mb-4">
          <ImageIcon className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-text-muted text-sm">No collections yet</p>
        <p className="text-text-muted text-xs mt-1">Your saved reference images will appear here</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      {collections.map((col, i) => (
        <motion.button
          key={col.name}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          onClick={() => onSelect(col.name)}
          className="glass rounded-2xl overflow-hidden text-left group cursor-pointer transition-all duration-300 hover:border-accent-500/20 hover:translate-y-[-2px] hover:shadow-lg hover:shadow-accent-500/5"
        >
          <div className="aspect-[16/10] bg-surface-3 overflow-hidden">
            {col.thumbnail ? (
              <img
                src={col.thumbnail}
                alt={col.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-text-muted/30" />
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="text-sm font-medium text-text-primary truncate">
              {col.name}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {col.imageCount} {col.imageCount === 1 ? "image" : "images"}
            </p>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
