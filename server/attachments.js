import { mkdirSync, createWriteStream, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import { DATA_DIR } from './dataPath.js';

export async function saveTelegramFile(bot, fileId, clientId, tagId) {
  const info = await bot.getFile(fileId);
  if (!info?.ok || !info.result?.file_path) {
    throw new Error('Faylni olish mumkin emas');
  }

  const remotePath = info.result.file_path;
  const ext = extname(remotePath) || '.jpg';
  const dir = join(DATA_DIR, 'attachments', clientId);
  mkdirSync(dir, { recursive: true });

  const filename = `${tagId}_${Date.now()}${ext}`;
  const absolutePath = join(dir, filename);
  await bot.downloadFile(remotePath, absolutePath);

  return {
    fileId,
    uniqueId: info.result.file_unique_id || '',
    path: `attachments/${clientId}/${filename}`,
    mimeType: ext.toLowerCase() === '.pdf' ? 'application/pdf' : 'image/jpeg',
    savedAt: new Date().toISOString(),
  };
}

export function attachmentAbsolutePath(relativePath) {
  return join(DATA_DIR, relativePath);
}

export function saveKycBuffer(clientId, docType, buffer, ext = '.jpg') {
  const dir = join(DATA_DIR, 'attachments', String(clientId));
  mkdirSync(dir, { recursive: true });
  const filename = `kyc_${docType}_${Date.now()}${ext}`;
  const absolutePath = join(dir, filename);
  writeFileSync(absolutePath, buffer);
  return {
    path: `attachments/${clientId}/${filename}`,
    mimeType: ext.toLowerCase() === '.png' ? 'image/png' : 'image/jpeg',
    savedAt: new Date().toISOString(),
  };
}

export function parseBase64Image(data) {
  const raw = String(data || '');
  const match = raw.match(/^data:image\/([\w+.-]+);base64,(.+)$/);
  if (match) {
    const ext = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
    return { ext, buffer: Buffer.from(match[2], 'base64') };
  }
  return { ext: '.jpg', buffer: Buffer.from(raw, 'base64') };
}
