import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCw, ZoomIn } from "lucide-react";

interface Props {
  open: boolean;
  file: File | null;
  aspect?: number;
  cropShape?: "rect" | "round";
  title?: string;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}

export function ImageCropDialog({
  open,
  file,
  aspect,
  cropShape = "rect",
  title = "Crop image",
  onCancel,
  onConfirm,
}: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setCroppedAreaPixels(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || !file) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation, file.type);
      // Normalize the output filename extension to match the actual blob MIME
      // (the cropper always returns image/png or image/jpeg).
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const cropped = new File([blob], `${baseName}-cropped.${ext}`, {
        type: blob.type,
        lastModified: Date.now(),
      });
      onConfirm(cropped);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-[400px] bg-gray-900 rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={cropShape}
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-gray-500 shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <RotateCw className="h-4 w-4 text-gray-500 shrink-0" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={(v) => setRotation(v[0])}
              className="flex-1"
            />
            <span className="text-xs text-gray-500 w-10 text-right">{rotation}°</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
            {processing ? "Processing…" : "Apply crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  mimeType: string,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  const rotRad = (rotation * Math.PI) / 180;
  const { width: bBoxWidth, height: bBoxHeight } = rotatedBoundingBox(
    image.width,
    image.height,
    rotation,
  );

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(data, 0, 0);

  const outType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = outType === "image/jpeg" ? 0.92 : undefined;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      outType,
      quality,
    );
  });
}

function rotatedBoundingBox(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}
