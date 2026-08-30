import { timingSafeEqual } from 'crypto';

const webSessions = new Map();
const failedAttempts = new Map();
const PANEL_SECRET = '887766';
const PANEL_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isPanelSecretConfigured(secret = PANEL_SECRET) {
  return /^\d{4,32}$/.test(String(secret || '').trim());
}

export function matchesPanelSecret(input, secret = PANEL_SECRET) {
  const candidate = String(input || '').trim();
  const expected = String(secret || '').trim();
  if (!isPanelSecretConfigured(expected) || !/^\d{4,32}$/.test(candidate)) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

function consumeAttempt(telegramId, now) {
  const key = String(Number(telegramId));
  const current = failedAttempts.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + ATTEMPT_WINDOW_MS }
    : current;
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  failedAttempts.set(key, entry);
  return true;
}

export function markStaffWebUnlocked(telegramId, now = Date.now()) {
  const id = Number(telegramId);
  if (!Number.isInteger(id) || id <= 0) return false;
  webSessions.set(String(id), now + PANEL_SESSION_TTL_MS);
  return true;
}

export function unlockStaffWeb(telegramId, code, now = Date.now()) {
  const id = Number(telegramId);
  if (!Number.isInteger(id) || id <= 0 || !consumeAttempt(id, now)) return false;
  if (!matchesPanelSecret(code)) return false;
  failedAttempts.delete(String(id));
  return markStaffWebUnlocked(id, now);
}

export function lockStaffWeb(telegramId) {
  webSessions.delete(String(Number(telegramId)));
}

export function isStaffWebUnlocked(telegramId, now = Date.now()) {
  const key = String(Number(telegramId));
  const expiresAt = webSessions.get(key) || 0;
  if (expiresAt <= now) {
    webSessions.delete(key);
    return false;
  }
  return true;
}
