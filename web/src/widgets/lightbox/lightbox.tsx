import { useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface LightboxProps {
  images: { url: string; label?: string; filename?: string }[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDownload?: (index: number) => void;
}

export function Lightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  onDownload,
}: LightboxProps) {
  const current = images[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, images.length, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, goNext, goPrev]);

  if (!current) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(currentIndex);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-border text-white hover:bg-accent-500 hover:border-accent-500 transition-all duration-200"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-border text-white hover:bg-white/[0.12] transition-all duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 glass rounded-full px-4 py-2 text-xs text-text-secondary font-mono tabular-nums">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-border text-white hover:bg-white/[0.12] transition-all duration-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Image */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.label ?? ""}
          className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl"
        />
        {current.label && (
          <p className="mt-3 text-center text-sm text-text-secondary">
            {current.label}
          </p>
        )}
      </motion.div>

      {/* Next */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-border text-white hover:bg-white/[0.12] transition-all duration-200"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </motion.div>
  );
}
