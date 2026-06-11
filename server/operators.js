import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const OPERATORS_FILE = join(DATA_DIR, 'operators.json');

function slugify(name) {
  return String(name).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_а-яё]/gi, '').slice(0, 24)
    || `op_${Date.now().toString(36)}`;
}

function loadData() {
  const raw = readJson(OPERATORS_FILE, null);
  if (raw?.operators) return raw;
  if (raw?.names?.length) {
    const migrated = {
      operators: raw.names.map((name, i) => ({
        id: `${slugify(name)}_${i}`,
        name,
        telegramId: null,
      })),
      updatedAt: new Date().toISOString(),
    };
    writeJson(OPERATORS_FILE, migrated);
    return migrated;
  }
  return { operators: [] };
}

function saveOperators(operators) {
  writeJson(OPERATORS_FILE, { operators, updatedAt: new Date().toISOString() });
}

export function listOperators() {
  return loadData().operators || [];
}

export function listOperatorNames() {
  return listOperators().map(o => o.name);
}

export function getOperatorById(id) {
  return listOperators().find(o => o.id === id) || null;
}

export function getOperatorByTelegramId(telegramId) {
  const n = Number(telegramId);
  return listOperators().find(o => o.telegramId === n) || null;
}

export function getOperatorByName(name) {
  return listOperators().find(o => o.name === name) || null;
}

export function isOperator(telegramId) {
  return !!getOperatorByTelegramId(telegramId);
}

export function addOperator(name, telegramId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Имя оператора не может быть пустым');

  const operators = listOperators();
  if (operators.some(o => o.name === trimmed)) {
    throw new Error('Оператор с таким именем уже есть');
  }
  if (telegramId) {
    const tid = Number(telegramId);
    if (operators.some(o => o.telegramId === tid)) {
      throw new Error('Этот Telegram ID уже добавлен');
    }
  }

  const op = {
    id: slugify(trimmed),
    name: trimmed,
    telegramId: telegramId ? Number(telegramId) : null,
  };
  operators.push(op);
  operators.sort((a, b) => String(a.telegramId || a.name).localeCompare(String(b.telegramId || b.name), 'ru'));
  saveOperators(operators);
  return op;
}

export function addOperatorByTelegramId(telegramId) {
  const tid = Number(telegramId);
  if (!Number.isInteger(tid) || tid <= 0) throw new Error('Неверный Telegram ID');

  const operators = listOperators();
  if (operators.some(o => o.telegramId === tid)) {
    throw new Error('Этот Telegram ID уже добавлен');
  }

  const op = {
    id: `tg_${tid}`,
    name: String(tid),
    telegramId: tid,
  };
  operators.push(op);
  operators.sort((a, b) => a.telegramId - b.telegramId);
  saveOperators(operators);
  return op;
}

export function linkOperator(telegramId, name) {
  const tid = Number(telegramId);
  if (Number.isNaN(tid)) throw new Error('Noto\'g\'ri Telegram ID');

  const operators = listOperators();
  const existing = operators.find(o => o.telegramId === tid);
  if (existing && existing.name !== name) {
    throw new Error(`ID boshqa operatorga bog\'langan: ${existing.name}`);
  }

  let op = operators.find(o => o.name === name);
  if (op) {
    op.telegramId = tid;
  } else {
    op = { id: slugify(name), name, telegramId: tid };
    operators.push(op);
  }
  saveOperators(operators);
  return op;
}

export function removeOperator(nameOrId) {
  const key = String(nameOrId).trim();
  const operators = listOperators().filter(o => o.name !== key && o.id !== key);
  if (operators.length === listOperators().length) throw new Error('Operator topilmadi');
  saveOperators(operators);
  return key;
}
