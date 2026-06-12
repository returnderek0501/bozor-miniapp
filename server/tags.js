import { existsSync } from 'fs';
import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';
import { isAdmin } from './admins.js';
import { getOperatorByTelegramId } from './operators.js';

const TAGS_FILE = join(DATA_DIR, 'tags.json');
const LEGACY_FILE = join(DATA_DIR, 'stages.json');

export const GLOBAL_TAG_COUNT = 3;

const DEFAULT_TAGS = [
  { id: 'pasport', label: 'Паспорт получен', description: 'Клиент прислал фото паспорта', scope: 'global' },
  { id: 'dogovor', label: 'Договор подписан', description: 'Клиент подписал договор', scope: 'global' },
  { id: 'v_rabote', label: 'В работе', description: 'Клиент в активной работе', scope: 'global' },
];

function migrateTag(tag, index) {
  if (!tag.scope) {
    tag.scope = index < GLOBAL_TAG_COUNT ? 'global' : (tag.ownerOperatorId ? 'operator' : 'global');
  }
  return tag;
}

function loadTagsFile() {
  let tags = DEFAULT_TAGS;
  if (existsSync(TAGS_FILE)) {
    const data = readJson(TAGS_FILE, { tags: DEFAULT_TAGS });
    tags = data.tags?.length ? data.tags : DEFAULT_TAGS;
  } else if (existsSync(LEGACY_FILE)) {
    const legacy = readJson(LEGACY_FILE, { stages: DEFAULT_TAGS });
    tags = legacy.stages || DEFAULT_TAGS;
  }
  tags = tags.map((t, i) => migrateTag({ ...t }, i));
  writeJson(TAGS_FILE, { tags, updatedAt: new Date().toISOString() });
  return { tags };
}

export function listTags() {
  return loadTagsFile().tags || DEFAULT_TAGS;
}

export function listTagsForUser(telegramId) {
  const all = listTags();
  if (isAdmin(telegramId)) return all;
  const op = getOperatorByTelegramId(telegramId);
  return all.filter((t, index) => {
    if (index < GLOBAL_TAG_COUNT || t.scope === 'global') return true;
    if (t.scope === 'operator') {
      return t.ownerOperatorId === op?.id || t.ownerTelegramId === Number(telegramId);
    }
    return true;
  });
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

export { slugify };

export function addTag(label, customId, actor = null) {
  const trimmed = String(label || '').trim();
  if (!trimmed) throw new Error('Название тега не может быть пустым');

  const tags = listTags();
  const id = customId?.trim() || slugify(trimmed);
  if (tags.some(t => t.id === id)) throw new Error(`Тег уже есть: ${id}`);

  const isGlobal = !actor || actor.isAdmin;
  const entry = {
    id,
    label: trimmed,
    description: '',
    scope: isGlobal ? 'global' : 'operator',
    ownerOperatorId: isGlobal ? null : (actor.operatorId || null),
    ownerTelegramId: isGlobal ? null : actor.id,
  };
  tags.push(entry);
  writeJson(TAGS_FILE, { tags, updatedAt: new Date().toISOString() });
  return entry;
}

export function removeTag(id) {
  const tags = listTags();
  const idx = tags.findIndex(t => t.id === id);
  if (idx < 0) throw new Error('Тег не найден');
  if (idx < GLOBAL_TAG_COUNT) throw new Error('Первые 3 тега удалить нельзя');
  const filtered = tags.filter(t => t.id !== id);
  writeJson(TAGS_FILE, { tags: filtered, updatedAt: new Date().toISOString() });
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
