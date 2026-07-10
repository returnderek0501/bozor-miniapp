import {
  mkdirSync, createWriteStream, writeFileSync, unlinkSync,
} from 'fs';
import {
  join, extname, resolve, sep,
} from 'path';
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
    mimeType: ext.toLowerCase() === '.png'
      ? 'image/png'
      : ext.toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg',
    size: buffer.length,
    savedAt: new Date().toISOString(),
  };
}

const KYC_MAX_FILE_BYTES = 3 * 1024 * 1024;
const KYC_MIN_FILE_BYTES = 512;
const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export function parseBase64Image(data) {
  const raw = String(data || '').trim();
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) throw new Error('INVALID_IMAGE');

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length < KYC_MIN_FILE_BYTES) throw new Error('IMAGE_TOO_SMALL');
  if (buffer.length > KYC_MAX_FILE_BYTES) throw new Error('IMAGE_TOO_LARGE');
  if (!hasExpectedSignature(buffer, mimeType)) throw new Error('INVALID_IMAGE');

  return { ext: MIME_EXTENSIONS[mimeType], mimeType, buffer };
}

export function deleteKycDocuments(documents) {
  const attachmentsRoot = resolve(DATA_DIR, 'attachments');
  for (const document of Object.values(documents || {})) {
    if (!document?.path) continue;
    const absolutePath = resolve(DATA_DIR, document.path);
    if (!absolutePath.startsWith(`${attachmentsRoot}${sep}`)) continue;
    try {
      unlinkSync(absolutePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error(`KYC attachment cleanup failed for ${document.path}:`, error.message);
      }
    }
  }
}
