import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const FILE = join(DATA_DIR, 'desk_sessions.json');
const MAX_RECENT = 12;

function readAll() {
  return readJson(FILE, {});
}

function writeAll(data) {
  writeJson(FILE, data);
}

function sessionKey(telegramId) {
  return String(telegramId);
}

export function getDeskSession(telegramId) {
  const all = readAll();
  return all[sessionKey(telegramId)] || { activeName: '', recentNames: [] };
}

export function getActiveDeskOperator(telegramId) {
  return getDeskSession(telegramId).activeName || '';
}

export function listRecentDeskNames(telegramId) {
  return getDeskSession(telegramId).recentNames || [];
}

export function rememberDeskOperatorName(telegramId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';

  const all = readAll();
  const key = sessionKey(telegramId);
  const session = all[key] || { activeName: '', recentNames: [] };

  session.activeName = trimmed;
  session.recentNames = [trimmed, ...(session.recentNames || []).filter(n => n !== trimmed)]
    .slice(0, MAX_RECENT);
  session.updatedAt = new Date().toISOString();
  all[key] = session;
  writeAll(all);
  return trimmed;
}

export function setActiveDeskOperator(telegramId, name) {
  return rememberDeskOperatorName(telegramId, name);
}

export function enrichActorWithDesk(actor, telegramId, deskName = null) {
  if (!actor) return null;
  const name = deskName || getActiveDeskOperator(telegramId);
  if (!name) return actor;
  return {
    ...actor,
    deskOperatorName: name,
    operatorName: name,
    name,
  };
}
