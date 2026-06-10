import { listEmployees } from './store.js';
import { listOperators } from './operators.js';
import { listTags } from './tags.js';
function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function todayClientsSummary() {
  const today = listEmployees().filter(e => isToday(e.createdAt));
  if (!today.length) return '<b>Клиенты за сегодня</b>\n\nПока никого не добавили.';

  const lines = today.map(e =>
    `• <b>${e.fullName || '—'}</b> — <code>${e.phone}</code>\n  Оператор: ${e.operator || e.createdByName || '—'}`,
  );
  return [`<b>Клиенты за сегодня (${today.length})</b>`, '', ...lines].join('\n');
}

export function operatorStatsSummary() {
  const employees = listEmployees();
  const ops = listOperators();
  const tagDefs = listTags();
  const byOp = new Map();

  for (const e of employees) {
    const key = e.operator || e.createdByName || 'Без оператора';
    if (!byOp.has(key)) {
      byOp.set(key, { clients: 0, tags: {} });
    }
    const row = byOp.get(key);
    row.clients += 1;
    for (const t of e.tags || []) {
      row.tags[t.id] = (row.tags[t.id] || 0) + 1;
    }
  }

  const knownNames = new Set(ops.map(o => o.name));
  const lines = [];

  for (const op of ops) {
    const row = byOp.get(op.name) || { clients: 0, tags: {} };
    const tagParts = tagDefs
      .filter(t => row.tags[t.id])
      .map(t => `${t.label}: ${row.tags[t.id]}`);
    lines.push([
      `<b>${op.name}</b> — клиентов: ${row.clients}`,
      tagParts.length ? `  Теги: ${tagParts.join(', ')}` : '  Теги: —',
    ].join('\n'));
    knownNames.delete(op.name);
  }

  for (const name of knownNames) {
    const row = byOp.get(name);
    if (!row) continue;
    const tagParts = Object.entries(row.tags).map(([id, n]) => `${id}: ${n}`);
    lines.push(`<b>${name}</b> — клиентов: ${row.clients}\n  Теги: ${tagParts.join(', ') || '—'}`);
  }

  if (!lines.length) return '<b>Сводка по операторам</b>\n\nДанных пока нет.';
  return [`<b>Сводка по операторам</b>`, '', ...lines].join('\n');
}
