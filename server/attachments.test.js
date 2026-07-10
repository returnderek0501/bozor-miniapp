import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBase64Image } from './attachments.js';

function dataUrl(mimeType, bytes) {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

test('parseBase64Image accepts a JPEG within KYC limits', () => {
  const bytes = Buffer.alloc(1_024);
  bytes.set([0xff, 0xd8, 0xff]);
  const parsed = parseBase64Image(dataUrl('image/jpeg', bytes));
  assert.equal(parsed.ext, '.jpg');
  assert.equal(parsed.mimeType, 'image/jpeg');
  assert.deepEqual(parsed.buffer, bytes);
});

test('parseBase64Image rejects unsupported and malformed images', () => {
  assert.throws(() => parseBase64Image('not-a-data-url'), /INVALID_IMAGE/);
  assert.throws(() => parseBase64Image('data:image/gif;base64,R0lGODlh'), /INVALID_IMAGE/);

  const wrongSignature = Buffer.alloc(1_024);
  assert.throws(
    () => parseBase64Image(dataUrl('image/jpeg', wrongSignature)),
    /INVALID_IMAGE/,
  );
});

test('parseBase64Image enforces minimum and maximum sizes', () => {
  const tiny = Buffer.alloc(16);
  tiny.set([0xff, 0xd8, 0xff]);
  assert.throws(() => parseBase64Image(dataUrl('image/jpeg', tiny)), /IMAGE_TOO_SMALL/);

  const large = Buffer.alloc(3 * 1024 * 1024 + 1);
  large.set([0xff, 0xd8, 0xff]);
  assert.throws(() => parseBase64Image(dataUrl('image/jpeg', large)), /IMAGE_TOO_LARGE/);
});
