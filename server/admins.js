import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const ADMINS_FILE = join(DATA_DIR, 'admins.json');
const BUILT_IN_ADMIN_IDS = [8889663205];

function envAdminIds() {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !Number.isNaN(n));
}

function storedIds() {
  const data = readJson(ADMINS_FILE, { ids: [] });
  return (data.ids || []).map(Number);
}

export function listAdmins() {
  const env = envAdminIds();
  const stored = storedIds();
  return [...new Set([...BUILT_IN_ADMIN_IDS, ...env, ...stored])].sort((a, b) => a - b);
}

export function isEnvAdmin(id) {
  const n = Number(id);
  return BUILT_IN_ADMIN_IDS.includes(n) || envAdminIds().includes(n);
}

export function isAdmin(id) {
  const n = Number(id);
  return listAdmins().includes(n);
}

export function addAdmin(id) {
  const n = Number(id);
  if (Number.isNaN(n)) throw new Error('Noto\'g\'ri Telegram ID');

  const data = readJson(ADMINS_FILE, { ids: [] });
  if (!data.ids.includes(n)) {
    data.ids.push(n);
    data.ids.sort((a, b) => a - b);
    data.updatedAt = new Date().toISOString();
    writeJson(ADMINS_FILE, data);
  }
  return n;
}

export function removeAdmin(id) {
  const n = Number(id);
  if (Number.isNaN(n)) throw new Error('Noto\'g\'ri Telegram ID');
  if (isEnvAdmin(n)) {
    throw new Error('ENV orqali qo\'shilgan adminni bot orqali o\'chirib bo\'lmaydi');
  }

  const data = readJson(ADMINS_FILE, { ids: [] });
  data.ids = data.ids.filter(x => x !== n);
  data.updatedAt = new Date().toISOString();
  writeJson(ADMINS_FILE, data);
  return n;
}
