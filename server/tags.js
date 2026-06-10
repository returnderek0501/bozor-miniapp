import { existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const TAGS_FILE = join(DATA_DIR, 'tags.json');
const LEGACY_FILE = join(DATA_DIR, 'stages.json');

const DEFAULT_TAGS = [
  { id: 'v_rabote', label: 'В работе', description: 'Клиент в активной работе' },
  { id: 'ozhidanie', label: 'Ожидание', description: 'Клиент в работе, ожидает переход на следующий этап' },
  { id: 'ignor', label: 'Игнор', description: 'Клиент игнорирует' },
];

function loadTagsFile() {
  if (existsSync(TAGS_FILE)) {
    const data = readJson(TAGS_FILE, { tags: DEFAULT_TAGS });
    return data.tags?.length ? data : { tags: DEFAULT_TAGS };
  }
  if (existsSync(LEGACY_FILE)) {
    const legacy = readJson(LEGACY_FILE, { stages: DEFAULT_TAGS });
    const migrated = { tags: legacy.stages || DEFAULT_TAGS, updatedAt: new Date().toISOString() };
    writeJson(TAGS_FILE, migrated);
    return migrated;
  }
  writeJson(TAGS_FILE, { tags: DEFAULT_TAGS, updatedAt: new Date().toISOString() });
  return { tags: DEFAULT_TAGS };
}

export function listTags() {
  return loadTagsFile().tags || DEFAULT_TAGS;
}

export function getTag(id) {
  return listTags().find(t => t.id === id) || null;
}

export function getTagLabel(id) {
  if (!id) return '—';
  return getTag(id)?.label || id;
}

function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_а-яё]/gi, '')
    .slice(0, 32) || `tag_${Date.now()}`;
}

export function addTag(label, customId) {
  const trimmed = String(label || '').trim();
  if (!trimmed) throw new Error('Teg nomi bo\'sh bo\'lmasligi kerak');

  const tags = listTags();
  const id = customId?.trim() || slugify(trimmed);
  if (tags.some(t => t.id === id)) throw new Error(`Teg ID mavjud: ${id}`);

  tags.push({ id, label: trimmed, description: '' });
  writeJson(TAGS_FILE, { tags, updatedAt: new Date().toISOString() });
  return { id, label: trimmed };
}

export function removeTag(id) {
  const tags = listTags().filter(t => t.id !== id);
  if (tags.length === listTags().length) throw new Error('Teg topilmadi');
  writeJson(TAGS_FILE, { tags, updatedAt: new Date().toISOString() });
  return id;
}

export function formatTagTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
