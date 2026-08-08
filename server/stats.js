import { listEmployees } from './store.js';
import { listOperators } from './operators.js';
import { listTags } from './tags.js';

export const STATS_RANGES = new Set(['hour', 'today', 'day', 'week', 'month', 'all']);

function moscowDayStart(nowMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(nowMs));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) - (3 * 60 * 60 * 1000);
}

export function resolveStatsRange(range = 'today', now = Date.now()) {
  const key = STATS_RANGES.has(range) ? range : 'today';
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const durations = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };
  const since = key === 'all'
    ? null
    : key === 'today'
      ? moscowDayStart(nowMs)
      : nowMs - durations[key];
  return { range: key, since: since === null ? null : new Date(since).toISOString() };
}

export function staffStatsData(range = 'today', employees = listEmployees(), now = Date.now()) {
  const window = resolveStatsRange(range, now);
  const sinceMs = window.since ? Date.parse(window.since) : 0;
  const rows = new Map();
  const rowFor = (name) => {
    const key = String(name || 'Без оператора');
    if (!rows.has(key)) {
      rows.set(key, {
        name: key,
        clientsTotal: 0,
        clientsCreated: 0,
        tagAssignments: 0,
        tagRemovals: 0,
        tags: {},
      });
    }
    return rows.get(key);
  };

  let clientsCreated = 0;
  let tagAssignments = 0;
  let tagRemovals = 0;
  for (const employee of employees) {
    const assignedName = employee.operator || employee.createdByName || 'Без оператора';
    const assignedRow = rowFor(assignedName);
    assignedRow.clientsTotal += 1;
    if (employee.createdAt && Date.parse(employee.createdAt) >= sinceMs) {
      assignedRow.clientsCreated += 1;
      clientsCreated += 1;
    }
    for (const event of employee.tagHistory || []) {
      if (!event.at || Date.parse(event.at) < sinceMs) continue;
      const actorRow = rowFor(event.byName || assignedName);
      if (event.action === 'remove') {
        actorRow.tagRemovals += 1;
        tagRemovals += 1;
      } else {
        const label = event.label || event.id || 'Без названия';
        actorRow.tagAssignments += 1;
        actorRow.tags[label] = (actorRow.tags[label] || 0) + 1;
        tagAssignments += 1;
      }
    }
  }

  return {
    ...window,
    generatedAt: new Date(now instanceof Date ? now.getTime() : Number(now)).toISOString(),
    totals: {
      clients: employees.length,
      clientsCreated,
      tagAssignments,
      tagRemovals,
    },
    operators: [...rows.values()].sort(
      (a, b) => b.tagAssignments - a.tagAssignments
        || b.clientsCreated - a.clientsCreated
        || a.name.localeCompare(b.name, 'ru'),
    ),
  };
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

export function isCreatedToday(iso) {
  return isToday(iso);
}

export function operatorStatsData() {
  const employees = listEmployees();
  const rows = new Map();
  for (const employee of employees) {
    const name = employee.operator || employee.createdByName || 'Без оператора';
    const row = rows.get(name) || { name, clients: 0, tags: {} };
    row.clients += 1;
    for (const tag of employee.tags || []) {
      row.tags[tag.label || tag.id] = (row.tags[tag.label || tag.id] || 0) + 1;
    }
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.clients - a.clients || a.name.localeCompare(b.name, 'ru'));
}

export function todayClientsSummary(employees = listEmployees()) {
  const today = employees.filter(e => isToday(e.createdAt));
  if (!today.length) return '<b>Клиенты за сегодня</b>\n\nПока никого не добавили.';

  const lines = today.map(e =>
    `• <b>${e.fullName || '—'}</b> — #${e.clientId || '—'} — <code>${e.phone}</code>\n  Оператор: ${e.operator || e.createdByName || '—'}`,
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
