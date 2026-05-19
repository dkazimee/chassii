import { useEffect, useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageCropDialog } from "@/components/ImageCropDialog";

interface ImageUploaderProps {
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  shape?: "square" | "circle";
  placeholder?: string;
  aspectRatio?: string;
  /** Enable crop step before upload. Defaults true for image uploads. */
  enableCrop?: boolean;
  /** Crop aspect ratio (width/height). Defaults to 1 for circle, undefined (free) otherwise. */
  cropAspect?: number;
  /** Optional title shown on the crop dialog. */
  cropTitle?: string;
}

export function ImageUploader({
  value,
  onChange,
  accept = "image/*",
  maxSizeMB = 10,
  className,
  shape = "square",
  placeholder = "Upload image",
  aspectRatio = "aspect-video",
  enableCrop = true,
  cropAspect,
  cropTitle,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);

  // Revoke the in-memory blob preview URL when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const isCircle = shape === "circle";
  const effectiveAspect = cropAspect ?? (isCircle ? 1 : undefined);

  const { uploadFile, isUploading, error } = useUpload({
    basePath: "/api/storage",
    onSuccess: (response) => {
      const path = response.objectPath.startsWith("/")
        ? response.objectPath
        : `/${response.objectPath}`;
      onChange(`/api/storage${path}`);
    },
  });

  async function uploadDirect(file: File) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const localPreview = URL.createObjectURL(file);
    previewUrlRef.current = localPreview;
    setPreview(localPreview);
    await uploadFile(file);
  }

  function handleFile(file: File) {
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File must be under ${maxSizeMB}MB`);
      return;
    }
    if (enableCrop && file.type.startsWith("image/")) {
      setFileToCrop(file);
    } else {
      void uploadDirect(file);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleClear() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    onChange("");
  }

  const displaySrc = preview ?? value;

  return (
    <div className={cn("relative group", isCircle ? "w-24 h-24" : "w-full", className)}>
      <ImageCropDialog
        open={!!fileToCrop}
        file={fileToCrop}
        aspect={effectiveAspect}
        cropShape={isCircle ? "round" : "rect"}
        title={cropTitle ?? (isCircle ? "Crop profile photo" : "Crop image")}
        onCancel={() => setFileToCrop(null)}
        onConfirm={(cropped) => {
          setFileToCrop(null);
          void uploadDirect(cropped);
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        disabled={isUploading}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        disabled={isUploading}
        className={cn(
          "w-full overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50",
          "hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer",
          "flex flex-col items-center justify-center text-center",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          isCircle
            ? "rounded-full h-24 w-24"
            : cn("rounded-xl", aspectRatio),
          displaySrc && "border-transparent bg-transparent",
        )}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt="Uploaded"
            className={cn(
              "w-full h-full object-cover",
              isCircle ? "rounded-full" : "rounded-xl",
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-gray-400">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            ) : (
              <Camera className="h-6 w-6" />
            )}
            {!isCircle && (
              <span className="text-xs font-medium">{placeholder}</span>
            )}
          </div>
        )}

        {isUploading && displaySrc && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/40",
            isCircle ? "rounded-full" : "rounded-xl",
          )}>
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        )}

        {!isUploading && displaySrc && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors",
            isCircle ? "rounded-full" : "rounded-xl",
          )}>
            <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </button>

      {displaySrc && !isUploading && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-0.5",
            "shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors",
            "opacity-0 group-hover:opacity-100",
          )}
          title="Remove image"
        >
          <X className="h-3.5 w-3.5 text-gray-500 hover:text-red-500" />
        </button>
      )}

      {error && (
        <p className="mt-1 text-xs text-red-500">{error.message}</p>
      )}
    </div>
  );
}
