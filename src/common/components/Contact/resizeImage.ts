// Phone photos are often 4000px and 5-10 MB. Before upload they are scaled
// down in the browser so they stay well under the API's limits (10 MB and
// 40 megapixels per picture) and upload quickly on mobile data.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_SIDE = 2000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Pictures this small and within MAX_SIDE are sent untouched. */
const SMALL_ENOUGH_BYTES = 1.5 * 1024 * 1024;

export class ImageError extends Error {
  constructor(public code: "unsupported_image" | "file_too_large") {
    super(code);
  }
}

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export const needsResize = (bytes: number, width: number, height: number) =>
  bytes > SMALL_ENOUGH_BYTES || Math.max(width, height) > MAX_SIDE;

/** PNG and WebP may be transparent (logos), so they become WebP; photos become JPEG. */
export const outputTypeFor = (sourceType: string) =>
  sourceType === "image/jpeg" ? "image/jpeg" : "image/webp";

const isAccepted = (type: string) => (ACCEPTED_TYPES as readonly string[]).includes(type);

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

async function encode(bitmap: ImageBitmap, sourceType: string): Promise<Blob> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  // Safari cannot encode WebP and silently returns PNG; that is still accepted.
  const blob = await canvasToBlob(canvas, outputTypeFor(sourceType));
  if (!blob) throw new ImageError("unsupported_image");
  return blob;
}

const extensionFor = (type: string) =>
  type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";

/** A file ready to upload, or an ImageError the form shows under the picker. */
export async function prepareImage(file: File): Promise<File> {
  if (!isAccepted(file.type)) throw new ImageError("unsupported_image");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageError(file.size > MAX_UPLOAD_BYTES ? "file_too_large" : "unsupported_image");
  }
  try {
    if (!needsResize(file.size, bitmap.width, bitmap.height)) return file;
    const blob = await encode(bitmap, file.type);
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageError("file_too_large");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "poza";
    return new File([blob], `${baseName}.${extensionFor(blob.type)}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}
