import { useEffect, useCallback } from "react";
import { X, Download } from "lucide-react";

interface ImageModalProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export function ImageModal({ src, alt, open, onClose }: ImageModalProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <a
            href={`${src}?download=1`}
            className="w-9 h-9 rounded-lg bg-obsidian-800/80 border border-obsidian-700 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-obsidian-750 transition-colors"
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-obsidian-800/80 border border-obsidian-700 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-obsidian-750 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <img
          src={src}
          alt={alt}
          className="w-full max-h-[85vh] object-contain rounded-xl"
        />
        {alt && (
          <p className="text-center text-sm text-zinc-400 mt-3">{alt}</p>
        )}
      </div>
    </div>
  );
}
