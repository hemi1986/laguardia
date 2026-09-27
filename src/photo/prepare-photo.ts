import { PHOTO_LIMITS } from "./limits";

/** Size that fits into maxEdge × maxEdge, keeping the aspect ratio; never enlarges. */
export function scaledSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const factor = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

export class PhotoNotReadableError extends Error {
  constructor() {
    super("photo-not-readable");
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/**
 * Decodes the photo upright: both paths apply the EXIF orientation (createImageBitmap with "from-image",
 * <img> with the default CSS image-orientation). HEIC decodes wherever the browser can (Safari).
 */
async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoNotReadableError();
    }
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoNotReadableError())), "image/jpeg", quality),
  );
}

/**
 * Browser half of the photo building block (ST-002): turns a camera or gallery photo into an upright JPEG of at
 * most PHOTO_LIMITS.maxEdgePx on the long edge and PHOTO_LIMITS.clientTargetBytes. The canvas carries no
 * metadata, so EXIF (incl. GPS) never leaves the phone; the server strips it again anyway.
 */
export async function preparePhoto(file: Blob): Promise<Blob> {
  const decoded = await decode(file);
  try {
    let maxEdge: number = PHOTO_LIMITS.maxEdgePx;
    for (let round = 0; round < 3; round++) {
      const { width, height } = scaledSize(decoded.width, decoded.height, maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(decoded.source, 0, 0, width, height);
      for (const quality of [0.85, 0.75, 0.65, 0.5]) {
        const jpeg = await toJpeg(canvas, quality);
        if (jpeg.size <= PHOTO_LIMITS.clientTargetBytes) return jpeg;
      }
      maxEdge = Math.round(maxEdge * 0.75);
    }
    throw new PhotoNotReadableError();
  } finally {
    decoded.close();
  }
}
