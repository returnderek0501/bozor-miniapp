import { timingSafeEqual } from 'crypto';

const unlockedSessions = new Map();
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function configuredSecret() {
  return String(process.env.STAFF_PANEL_SECRET || '').trim();
}

function sessionKey(chatId, telegramId) {
  return `${Number(chatId)}:${Number(telegramId)}`;
}

function sessionTtlMs() {
  const hours = Number(process.env.STAFF_PANEL_SESSION_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_SESSION_TTL_MS;
  return Math.min(hours, 24 * 7) * 60 * 60 * 1000;
}

export function isPanelSecretConfigured(secret = configuredSecret()) {
  return /^\d{4,32}$/.test(String(secret || '').trim());
}

export function matchesPanelSecret(input, secret = configuredSecret()) {
  const candidate = String(input || '').trim();
  const expected = String(secret || '').trim();
  if (!isPanelSecretConfigured(expected) || !/^\d{4,32}$/.test(candidate)) return false;

  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function requiresPanelUnlockForCallback(data) {
  const action = String(data || '');
  return !(
    action.startsWith('kyc_ok:')
    || action.startsWith('kyc_rej:')
    || action.startsWith('kyc_reason:')
  );
}

export function unlockPanel(chatId, telegramId, now = Date.now()) {
  unlockedSessions.set(sessionKey(chatId, telegramId), now + sessionTtlMs());
}

export function lockPanel(chatId, telegramId) {
  unlockedSessions.delete(sessionKey(chatId, telegramId));
}

export function isPanelUnlocked(chatId, telegramId, now = Date.now()) {
  const key = sessionKey(chatId, telegramId);
  const expiresAt = unlockedSessions.get(key) || 0;
  if (expiresAt <= now) {
    unlockedSessions.delete(key);
    return false;
  }
  return true;
}
