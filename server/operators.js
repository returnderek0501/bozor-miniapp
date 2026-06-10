import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const OPERATORS_FILE = join(DATA_DIR, 'operators.json');

export function listOperators() {
  const data = readJson(OPERATORS_FILE, { names: [] });
  return data.names || [];
}

export function addOperator(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Operator nomi bo\'sh bo\'lmasligi kerak');

  const data = readJson(OPERATORS_FILE, { names: [] });
  if (!data.names.includes(trimmed)) {
    data.names.push(trimmed);
    data.names.sort((a, b) => a.localeCompare(b, 'ru'));
    data.updatedAt = new Date().toISOString();
    writeJson(OPERATORS_FILE, data);
  }
  return trimmed;
}

export function removeOperator(name) {
  const trimmed = String(name || '').trim();
  const data = readJson(OPERATORS_FILE, { names: [] });
  data.names = data.names.filter(n => n !== trimmed);
  data.updatedAt = new Date().toISOString();
  writeJson(OPERATORS_FILE, data);
  return trimmed;
}
