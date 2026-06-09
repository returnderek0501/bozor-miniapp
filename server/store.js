import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const PHONES_FILE = join(DATA_DIR, 'phones.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Normalize Uzbek phone to +998XXXXXXXXX */
export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }
  return null;
}

export function listPhones() {
  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  return data.phones || [];
}

export function addPhone(raw, addedBy) {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami. Misol: +998901234567');

  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  if (!data.phones.includes(phone)) {
    data.phones.push(phone);
    data.phones.sort();
    data.updatedAt = new Date().toISOString();
    data.addedBy = addedBy;
    writeJson(PHONES_FILE, data);
  }
  return phone;
}

export function removePhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');

  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  data.phones = data.phones.filter(p => p !== phone);
  data.updatedAt = new Date().toISOString();
  writeJson(PHONES_FILE, data);
  return phone;
}

export function isPhoneAllowed(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return false;
  return listPhones().includes(phone);
}

export function getSession(telegramId) {
  const sessions = readJson(SESSIONS_FILE, {});
  return sessions[String(telegramId)] || null;
}

export function setSession(telegramId, phone) {
  const sessions = readJson(SESSIONS_FILE, {});
  sessions[String(telegramId)] = {
    phone: normalizePhone(phone),
    verifiedAt: new Date().toISOString(),
  };
  writeJson(SESSIONS_FILE, sessions);
  return sessions[String(telegramId)];
}

export function clearSession(telegramId) {
  const sessions = readJson(SESSIONS_FILE, {});
  delete sessions[String(telegramId)];
  writeJson(SESSIONS_FILE, sessions);
}
