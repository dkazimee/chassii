import { useEffect, useState, useCallback, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type LightboxProps = {
  images: string[];
  startIndex?: number;
  alt?: string;
  onClose: () => void;
};

function LightboxOverlay({ images, startIndex = 0, alt = "", onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const hasMany = images.length > 1;

  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMany) prev();
      if (e.key === "ArrowRight" && hasMany) next();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, hasMany]);

  function stop(e: MouseEvent) {
    e.stopPropagation();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="lightbox-overlay"
    >
      <button
        type="button"
        onClick={(e) => { stop(e); onClose(); }}
        className="absolute top-4 right-4 z-10 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
        aria-label="Close image viewer"
        data-testid="button-lightbox-close"
      >
        <X className="h-5 w-5" />
      </button>

      {hasMany && (
        <>
          <button
            type="button"
            onClick={(e) => { stop(e); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { stop(e); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-white/10 text-white text-sm backdrop-blur-md">
            {index + 1} / {images.length}
          </div>
        </>
      )}

      <img
        src={images[index]}
        alt={alt}
        onClick={stop}
        className="max-h-[92vh] max-w-[92vw] object-contain select-none animate-in zoom-in-95 duration-150"
        draggable={false}
      />
    </div>,
    document.body,
  );
}

/**
 * Hook that returns a state opener and a Lightbox element ready to render.
 * Usage:
 *   const { open, element } = useLightbox();
 *   <img onClick={() => open([url])} ... />
 *   {element}
 */
export function useLightbox() {
  const [state, setState] = useState<{ images: string[]; index: number; alt?: string } | null>(null);

  const open = useCallback((images: string | string[], index = 0, alt?: string) => {
    const arr = Array.isArray(images) ? images : [images];
    if (arr.length === 0) return;
    setState({ images: arr, index, alt });
  }, []);

  const close = useCallback(() => setState(null), []);

  const element = state ? (
    <LightboxOverlay images={state.images} startIndex={state.index} alt={state.alt} onClose={close} />
  ) : null;

  return { open, close, element };
}
