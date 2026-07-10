export interface PreparedKycImage {
  dataUrl: string;
  size: number;
}

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const MAX_DIMENSION = 1800;
const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid_image'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('read_failed'))),
      'image/jpeg',
      quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(blob);
  });
}

export async function prepareKycImage(file: File): Promise<PreparedKycImage> {
  const supportedMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!supportedMime && !(file.type === '' && SUPPORTED_EXTENSIONS.test(file.name))) {
    throw new Error('invalid_image');
  }
  if (file.size > MAX_SOURCE_BYTES) throw new Error('source_too_large');

  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('invalid_image');

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('read_failed');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToBlob(canvas, 0.86);
  for (const quality of [0.74, 0.62, 0.5]) {
    if (blob.size <= MAX_OUTPUT_BYTES) break;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > MAX_OUTPUT_BYTES) throw new Error('source_too_large');

  return {
    dataUrl: await blobToDataUrl(blob),
    size: blob.size,
  };
}
