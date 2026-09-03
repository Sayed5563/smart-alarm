/** Resize/compress an uploaded image to keep IndexedDB usage sane.
 *  Returns a JPEG/WebP blob no wider/taller than `maxEdge`. */
export async function resizeImage(
  file: File,
  maxEdge = 1920,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Fallback: store original untouched.
    return { blob: file, width: 0, height: 0 };
  }
  let { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!ctx) return { blob: file, width: bitmap.width, height: bitmap.height };
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const type = 'image/webp';
  let blob: Blob;
  if ('convertToBlob' in canvas) {
    blob = await (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  } else {
    blob = await new Promise<Blob>((resolve, reject) =>
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        type,
        quality,
      ),
    );
  }
  return { blob, width, height };
}
