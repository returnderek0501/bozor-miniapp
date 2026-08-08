import { formatTagTime } from './tags.js';
import { kycStatusLabel } from './kyc.js';
import { getSessionByPhone } from './store.js';

export const HEADERS_MAIN = [
  'ID клиента',
  'Телефон',
  'Telegram ID',
  'Telegram username',
  'Имя в Telegram',
  'Telegram привязан',
  'Последний визит',
  'ФИО',
  'Должность',
  'Возраст',
  'Семейное положение',
  'ID сотрудника',
  'Аванс (сум)',
  'Оператор',
  'Активные теги',
  'Создан',
  'Обновлён',
  'Внёс в систему',
  'KYC статус',
  'KYC подано',
  'KYC проверено',
  'KYC проверил',
  'KYC ID-карта (лицевая)',
  'KYC ID-карта (обратная)',
  'KYC селфи',
  'KYC причина отказа',
];

export const HEADERS_KYC = [
  'ID клиента',
  'Телефон',
  'ФИО',
  'Оператор',
  'KYC статус',
  'Подано',
  'Проверено',
  'Проверил',
  'Файл ID-карты (лицевая)',
  'Файл ID-карты (обратная)',
  'Файл селфи',
  'Причина отказа',
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
  const session = getSessionByPhone(emp.phone);
  const telegramName = [session?.firstName, session?.lastName].filter(Boolean).join(' ');
  return [
    emp.clientId || '',
    emp.phone,
    session?.telegramId || '',
    session?.username ? `@${session.username}` : '',
    telegramName,
    session?.telegramId ? 'да' : 'нет',
    session?.lastSeenAt ? formatTagTime(session.lastSeenAt) : '',
    emp.fullName || '',
    emp.position || 'Agent',
    emp.age ?? '',
    emp.maritalStatus || '',
    emp.employeeId || '',
    emp.advanceBalance ?? 0,
    emp.operator || '',
    formatActiveTags(emp),
    emp.createdAt ? formatTagTime(emp.createdAt) : '',
    emp.updatedAt ? formatTagTime(emp.updatedAt) : '',
    emp.createdByName || '',
    kycStatusLabel(emp.kycStatus || 'none'),
    emp.kycSubmittedAt ? formatTagTime(emp.kycSubmittedAt) : '',
    emp.kycReviewedAt ? formatTagTime(emp.kycReviewedAt) : '',
    emp.kycReviewedByName || '',
    emp.kycDocuments?.idCardFront?.path || '',
    emp.kycDocuments?.idCardBack?.path || '',
    emp.kycDocuments?.selfie?.path || '',
    emp.kycRejectionReason || '',
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

export function kycRows(employees) {
  return employees
    .filter(emp => emp.kycStatus && emp.kycStatus !== 'none')
    .map(emp => [
      emp.clientId || '',
      emp.phone,
      emp.fullName || '',
      emp.operator || '',
      kycStatusLabel(emp.kycStatus),
      emp.kycSubmittedAt ? formatTagTime(emp.kycSubmittedAt) : '',
      emp.kycReviewedAt ? formatTagTime(emp.kycReviewedAt) : '',
      emp.kycReviewedByName || '',
      emp.kycDocuments?.idCardFront?.path || '',
    emp.kycDocuments?.idCardBack?.path || '',
      emp.kycDocuments?.selfie?.path || '',
      emp.kycRejectionReason || '',
    ])
    .sort((a, b) => String(b[5]).localeCompare(String(a[5])));
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
