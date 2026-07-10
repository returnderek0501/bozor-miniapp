import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { validateInitData } from './telegram.js';

function signedInitData(botToken, authDate) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'test-query',
    user: JSON.stringify({ id: 123, first_name: 'Test' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('validateInitData accepts a fresh signed Telegram payload', () => {
  const initData = signedInitData('token', 10_000);
  assert.deepEqual(
    validateInitData(initData, 'token', { nowSeconds: 10_100 }),
    { id: 123, first_name: 'Test' },
  );
});

test('validateInitData rejects expired or future Telegram payloads', () => {
  const expired = signedInitData('token', 10_000);
  assert.equal(validateInitData(expired, 'token', { nowSeconds: 100_000 }), null);

  const future = signedInitData('token', 11_000);
  assert.equal(validateInitData(future, 'token', { nowSeconds: 10_000 }), null);
});

test('validateInitData rejects an invalid signature', () => {
  const initData = signedInitData('token', 10_000);
  assert.equal(validateInitData(initData, 'wrong-token', { nowSeconds: 10_100 }), null);
});
