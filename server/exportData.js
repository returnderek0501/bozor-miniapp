import { formatTagTime } from './tags.js';

function maskCard(card) {
  if (!card || card.length < 8) return card;
  return `${card.slice(0, 4)} **** **** ${card.slice(-4)}`;
}

export const HEADERS_MAIN = [
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
  'Создал',
];

export const HEADERS_TAG_HISTORY = [
  'Телефон',
  'ФИО',
  'Оператор',
  'Тег',
  'Действие',
  'Время',
  'Кто назначил',
];

function formatActiveTags(emp) {
  if (!emp.tags?.length) return '';
  return emp.tags
    .map(t => `${t.label} @ ${formatTagTime(t.assignedAt)}`)
    .join('; ');
}

export function rowFromEmployee(emp) {
  return [
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
        emp.phone,
        emp.fullName || '',
        emp.operator || '',
        h.label || h.id,
        h.action === 'remove' ? 'Снят' : 'Добавлен',
        formatTagTime(h.at),
        h.byName || (h.by ? String(h.by) : ''),
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
