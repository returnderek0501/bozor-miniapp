import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

const defaultNotifications = () => [
  {
    id: 'n1',
    title: '🚨 Bitcoin bo\'yicha shoshilinch signal!',
    body: 'BTC/USDT: $68,420 darajasida SHOSHILINCH SOTIB OLING',
    type: 'urgent',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    signalId: 's1',
  },
  {
    id: 'n2',
    title: '📊 Yangi signal: NVDA',
    body: 'NVIDIA: Sotib olish signali. Potensial +8.5%',
    type: 'signal',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    signalId: 's6',
  },
  {
    id: 'n3',
    title: '⚡ TSLA: Shoshilinch sotish',
    body: 'Tesla qarshilik zonasiga yetdi. Hozir soting!',
    type: 'urgent',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    signalId: 's2',
  },
];

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDataDir();
  if (!existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureDataDir();
  writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

export function defaultProfile(telegramId, tgUser) {
  return {
    telegramId: Number(telegramId),
    displayName: tgUser
      ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
      : 'Investor',
    balance: 24850,
    balanceChangePct: 3.24,
    totalSignals: 10,
    successRate: 78,
    memberSince: 2024,
    level: 'Investor',
    language: 'uz',
    signalIds: null,
    portfolio: null,
    notifications: defaultNotifications(),
  };
}

export function getUser(telegramId, tgUser) {
  const all = readAll();
  const key = String(telegramId);
  if (!all[key]) {
    all[key] = defaultProfile(telegramId, tgUser);
    writeAll(all);
  }
  return all[key];
}

export function updateUser(telegramId, patch) {
  const all = readAll();
  const key = String(telegramId);
  const current = all[key] || defaultProfile(telegramId);
  all[key] = { ...current, ...patch, telegramId: Number(telegramId) };
  writeAll(all);
  return all[key];
}

export function setUserField(telegramId, field, value) {
  const allowed = [
    'displayName', 'balance', 'balanceChangePct', 'totalSignals',
    'successRate', 'memberSince', 'level', 'language', 'signalIds', 'portfolio',
  ];
  if (!allowed.includes(field)) {
    throw new Error(`Unknown field: ${field}`);
  }

  let parsed = value;
  if (['balance', 'balanceChangePct', 'totalSignals', 'successRate', 'memberSince'].includes(field)) {
    parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error(`Invalid number for ${field}`);
  }
  if (field === 'language' && !['uz', 'ru'].includes(value)) {
    throw new Error('language must be uz or ru');
  }
  if (field === 'signalIds') {
    parsed = value === 'all' || value === 'null' ? null : value.split(',').map(s => s.trim());
  }
  if (field === 'portfolio') {
    parsed = value === 'null' ? null : JSON.parse(value);
  }

  return updateUser(telegramId, { [field]: parsed });
}

export function addNotification(telegramId, notification) {
  const user = getUser(telegramId);
  const notif = {
    id: `n${Date.now()}`,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notification,
  };
  user.notifications = [notif, ...(user.notifications || [])];
  updateUser(telegramId, { notifications: user.notifications });
  return notif;
}

export function markNotificationRead(telegramId, notifId) {
  const user = getUser(telegramId);
  user.notifications = (user.notifications || []).map(n =>
    n.id === notifId ? { ...n, isRead: true } : n
  );
  updateUser(telegramId, { notifications: user.notifications });
  return user.notifications;
}

export function markAllNotificationsRead(telegramId) {
  const user = getUser(telegramId);
  user.notifications = (user.notifications || []).map(n => ({ ...n, isRead: true }));
  updateUser(telegramId, { notifications: user.notifications });
  return user.notifications;
}

export function listUsers() {
  return readAll();
}
