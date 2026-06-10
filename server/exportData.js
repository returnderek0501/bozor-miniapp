import { formatTagTime } from './tags.js';

function maskCard(card) {
  if (!card || card.length < 8) return card;
  return `${card.slice(0, 4)} **** **** ${card.slice(-4)}`;
}

export const HEADERS_MAIN = [
  'ID клиента',
  'Телефон',
  'ФИО',
  'Должность',
  'Отдел',
  'Стаж',
  'ID сотрудника',
  'Аванс (сум)',
  'Оператор',
  'Активные теги',
  'Карты',
  'Создан',
  'Обновлён',
  'Внёс в систему',
];

export const HEADERS_PHOTOS = [
  'ID клиента',
  'Телефон',
  'ФИО',
  'Оператор',
  'Тег',
  'Время',
  'Файл',
];

export const HEADERS_TAG_HISTORY = [
  'ID клиента',
  'Телефон',
  'ФИО',
  'Оператор',
  'Тег',
  'Действие',
  'Время',
  'Кто назначил',
  'Комментарий',
  'Фото',
];

function formatActiveTags(emp) {
  if (!emp.tags?.length) return '';
  return emp.tags
    .map(t => `${t.label} @ ${formatTagTime(t.assignedAt)}`)
    .join('; ');
}

export function rowFromEmployee(emp) {
  return [
    emp.clientId || '',
    emp.phone,
    emp.fullName || '',
    emp.position || '',
    emp.department || '',
    emp.tenure || '',
    emp.employeeId || '',
    emp.advanceBalance ?? 0,
    emp.operator || '',
    formatActiveTags(emp),
    (emp.allowedCards || []).map(c => maskCard(c)).join(', '),
    emp.createdAt ? formatTagTime(emp.createdAt) : '',
    emp.updatedAt ? formatTagTime(emp.updatedAt) : '',
    emp.createdByName || '',
  ];
}

export function rowsFromEmployees(employees) {
  return employees.map(rowFromEmployee);
}

export function tagHistoryRows(employees) {
  const rows = [];
  for (const emp of employees) {
    for (const h of emp.tagHistory || []) {
      rows.push([
        emp.clientId || '',
        emp.phone,
        emp.fullName || '',
        emp.operator || '',
        h.label || h.id,
        h.action === 'remove' ? 'Снят' : h.action === 'photo' ? 'Фото' : 'Добавлен',
        formatTagTime(h.at),
        h.byName || (h.by ? String(h.by) : ''),
        h.note || '',
        h.photo?.path ? 'да' : '—',
      ]);
    }
  }
  return rows.sort((a, b) => String(b[6]).localeCompare(String(a[6])));
}

export function photoRows(employees) {
  const rows = [];
  for (const emp of employees) {
    for (const t of emp.tags || []) {
      if (!t.photo?.path && !t.photo?.fileId) continue;
      rows.push([
        emp.clientId || '',
        emp.phone,
        emp.fullName || '',
        emp.operator || '',
        t.label || t.id,
        formatTagTime(t.assignedAt),
        t.photo?.path || 'telegram',
      ]);
    }
  }
  return rows.sort((a, b) => String(b[5]).localeCompare(String(a[5])));
}

export function groupByOperator(employees) {
  const groups = new Map();
  for (const emp of employees) {
    const key = emp.operator || 'Без оператора';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(emp);
  }
  return groups;
}

export function sanitizeSheetName(name) {
  return String(name)
    .replace(/[\\/?*[\]]/g, '')
    .slice(0, 31) || 'Лист';
}
