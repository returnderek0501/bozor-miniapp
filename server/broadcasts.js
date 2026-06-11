import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';
import { listOperators } from './operators.js';
import { isAdmin } from './admins.js';
import {
  listTelegramIdsForPhones,
  listAllClientTelegramIds,
  listEmployeesForUser,
} from './store.js';
import { getActiveDeskOperator } from './deskOperators.js';

const FILE = join(DATA_DIR, 'broadcasts.json');

function readAll() {
  return readJson(FILE, { items: [] });
}

function writeAll(data) {
  writeJson(FILE, data);
}

export function createBroadcastRequest(text, createdBy, scope) {
  const data = readAll();
  const item = {
    id: `BC-${Date.now().toString(36)}`,
    text,
    createdBy: Number(createdBy),
    scope,
    status: scope === 'all' ? 'pending' : 'ready',
    operatorApprovals: [],
    adminApproval: null,
    createdAt: new Date().toISOString(),
  };
  data.items.push(item);
  writeAll(data);
  return item;
}

export function getBroadcast(id) {
  return readAll().items.find(b => b.id === id) || null;
}

export function listPendingBroadcasts() {
  return readAll().items.filter(b => b.status === 'pending');
}

export function approveBroadcast(id, telegramId) {
  const data = readAll();
  const bc = data.items.find(b => b.id === id);
  if (!bc || bc.status !== 'pending') return null;

  const tid = Number(telegramId);
  if (isAdmin(tid)) {
    bc.adminApproval = tid;
    bc.status = 'ready';
  } else {
    if (!bc.operatorApprovals.includes(tid)) {
      bc.operatorApprovals.push(tid);
    }
    const linkedOps = listOperators().filter(o => o.telegramId);
    const allApproved = linkedOps.length > 0
      && linkedOps.every(o => bc.operatorApprovals.includes(o.telegramId));
    if (allApproved) bc.status = 'ready';
  }

  writeAll(data);
  return bc;
}

export function markBroadcastSent(id) {
  const data = readAll();
  const bc = data.items.find(b => b.id === id);
  if (!bc) return null;
  bc.status = 'sent';
  bc.sentAt = new Date().toISOString();
  writeAll(data);
  return bc;
}

export function resolveBroadcastRecipients(bc, creatorTelegramId) {
  if (bc.scope === 'one' && bc.targetPhone) {
    return listTelegramIdsForPhones([bc.targetPhone]);
  }
  if (bc.scope === 'mine') {
    const desk = getActiveDeskOperator(creatorTelegramId);
    const phones = listEmployeesForUser(creatorTelegramId, desk).map(e => e.phone);
    return listTelegramIdsForPhones(phones);
  }
  if (bc.scope === 'all') {
    return listAllClientTelegramIds();
  }
  return [];
}

export function formatBroadcastApproval(bc) {
  const linkedOps = listOperators().filter(o => o.telegramId);
  const opDone = linkedOps.filter(o => bc.operatorApprovals.includes(o.telegramId));
  return [
    `<b>Рассылка всем — на подтверждении</b>`,
    `ID: <code>${bc.id}</code>`,
    `Текст: ${bc.text.slice(0, 200)}${bc.text.length > 200 ? '…' : ''}`,
    `Операторы: ${opDone.length}/${linkedOps.length}`,
    bc.adminApproval ? '✅ Подтверждено админом' : 'Админ: ожидает',
    '',
    'Нужно: все операторы <b>или</b> один админ.',
  ].join('\n');
}
