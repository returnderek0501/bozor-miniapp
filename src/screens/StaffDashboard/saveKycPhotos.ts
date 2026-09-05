export type KycDocType = 'idCardFront' | 'idCardBack' | 'selfie';

export const KYC_DOC_TYPES: KycDocType[] = ['idCardFront', 'idCardBack', 'selfie'];

export function kycPhotoFilename(prefix: string, docType: KycDocType, blob?: Blob) {
  const type = blob?.type || '';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return `kyc_${prefix}_${docType}.${ext}`;
}

function triggerAnchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function savePhotosToGallery(files: Array<{ blob: Blob; filename: string }>) {
  if (!files.length) return;

  const nativeFiles = files.map(file => new File(
    [file.blob],
    file.filename,
    { type: file.blob.type || 'image/jpeg' },
  ));

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: nativeFiles })) {
    try {
      await navigator.share({ files: nativeFiles, title: 'KYC фото' });
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
  }

  files.forEach((file, index) => {
    window.setTimeout(() => {
      triggerAnchorDownload(file.blob, file.filename);
      if (index === 0) window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    }, index * 200);
  });
}

export async function savePhotoUrlsToGallery(
  items: Array<{ url: string; filename: string }>,
) {
  const files = await Promise.all(items.map(async item => {
    const blob = await fetch(item.url).then(response => response.blob());
    return { blob, filename: item.filename };
  }));
  await savePhotosToGallery(files);
}
