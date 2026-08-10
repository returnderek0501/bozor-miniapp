import { createHmac, timingSafeEqual } from 'crypto';
import {
  isPanelSecretConfigured, matchesPanelSecret, markStaffWebUnlocked, lockStaffWeb,
  isStaffWebUnlocked,
} from './panelAccess.js';
import { isAdmin } from './admins.js';

export const DEFAULT_BROWSER_ADMIN_PATH = '/ops-uztronix-x7m2';
export const BROWSER_COOKIE_NAME = 'uz_browser_staff';
const BROWSER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const failedAttempts = new Map();

export function getBrowserAdminPath() {
  const raw = String(process.env.BROWSER_ADMIN_PATH || DEFAULT_BROWSER_ADMIN_PATH).trim();
  if (!raw.startsWith('/')) return DEFAULT_BROWSER_ADMIN_PATH;
  if (raw.length < 8 || raw.length > 64) return DEFAULT_BROWSER_ADMIN_PATH;
  if (!/^\/[a-z0-9/_-]+$/i.test(raw)) return DEFAULT_BROWSER_ADMIN_PATH;
  return raw.replace(/\/+$/, '') || DEFAULT_BROWSER_ADMIN_PATH;
}

function sessionSecret() {
  return String(
    process.env.BROWSER_SESSION_SECRET
    || process.env.BOT_TOKEN
    || 'uztronix-browser-staff-fallback',
  );
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

export function signBrowserSession(telegramId, now = Date.now()) {
  const id = Number(telegramId);
  const exp = now + BROWSER_SESSION_TTL_MS;
  const payload = `${id}.${exp}`;
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyBrowserSession(token, now = Date.now()) {
  const raw = String(token || '');
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [idPart, expPart, sig] = parts;
  const telegramId = Number(idPart);
  const exp = Number(expPart);
  if (!Number.isInteger(telegramId) || telegramId <= 0 || !Number.isFinite(exp) || exp <= now) {
    return null;
  }
  const payload = `${telegramId}.${exp}`;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  const sigBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  if (!isAdmin(telegramId)) return null;
  return { telegramId, expiresAt: exp };
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function readBrowserSession(req, now = Date.now()) {
  const cookies = parseCookies(req?.headers?.cookie);
  return verifyBrowserSession(cookies[BROWSER_COOKIE_NAME], now);
}

export function browserSessionCookie(token, { secure = false } = {}) {
  const parts = [
    `${BROWSER_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(BROWSER_SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearBrowserSessionCookie({ secure = false } = {}) {
  const parts = [
    `${BROWSER_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function loginBrowserAdmin(telegramId, code, now = Date.now()) {
  const id = Number(telegramId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'INVALID_TELEGRAM_ID' };
  if (!isPanelSecretConfigured()) return { ok: false, error: 'ACCESS_DENIED' };
  if (!consumeAttempt(id, now)) return { ok: false, error: 'TOO_MANY_ATTEMPTS' };
  if (!isAdmin(id)) return { ok: false, error: 'ADMIN_REQUIRED' };
  if (!matchesPanelSecret(code)) return { ok: false, error: 'ACCESS_DENIED' };
  failedAttempts.delete(String(id));
  markStaffWebUnlocked(id, now);
  return {
    ok: true,
    telegramId: id,
    token: signBrowserSession(id, now),
  };
}

export function logoutBrowserAdmin(telegramId) {
  if (telegramId) lockStaffWeb(telegramId);
}

export function isBrowserStaffUnlocked(telegramId, now = Date.now()) {
  return isStaffWebUnlocked(telegramId, now);
}
