import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const STAGES_FILE = join(DATA_DIR, 'stages.json');

const DEFAULT_STAGES = [
  { id: 'v_rabote', label: 'В работе', description: 'Клиент в активной работе' },
  { id: 'ozhidanie', label: 'Ожидание', description: 'Клиент в работе, ожидает переход на следующий этап' },
  { id: 'ignor', label: 'Игнор', description: 'Клиент игнорирует' },
];

function ensureDefaults() {
  const data = readJson(STAGES_FILE, null);
  if (!data?.stages?.length) {
    writeJson(STAGES_FILE, { stages: DEFAULT_STAGES, updatedAt: new Date().toISOString() });
  }
}

export function listStages() {
  ensureDefaults();
  const data = readJson(STAGES_FILE, { stages: DEFAULT_STAGES });
  return data.stages || DEFAULT_STAGES;
}

export function getStage(id) {
  return listStages().find(s => s.id === id) || null;
}

export function getStageLabel(id) {
  if (!id) return '—';
  const s = getStage(id);
  return s?.label || id;
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё]/gi, '')
    .slice(0, 32) || `stage_${Date.now()}`;
}

export function addStage(label, customId) {
  const trimmed = String(label || '').trim();
  if (!trimmed) throw new Error('Etap nomi bo\'sh bo\'lmasligi kerak');

  const stages = listStages();
  const id = customId?.trim() || slugify(trimmed);
  if (stages.some(s => s.id === id)) {
    throw new Error(`Etap ID mavjud: ${id}`);
  }

  stages.push({ id, label: trimmed, description: '' });
  writeJson(STAGES_FILE, { stages, updatedAt: new Date().toISOString() });
  return { id, label: trimmed };
}

export function removeStage(id) {
  const stages = listStages().filter(s => s.id !== id);
  if (stages.length === listStages().length) {
    throw new Error('Etap topilmadi');
  }
  writeJson(STAGES_FILE, { stages, updatedAt: new Date().toISOString() });
  return id;
}
