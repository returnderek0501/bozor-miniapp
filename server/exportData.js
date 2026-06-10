import { getStageLabel } from './stages.js';

function maskCard(card) {
  if (!card || card.length < 8) return card;
  return `${card.slice(0, 4)} **** **** ${card.slice(-4)}`;
}

export const HEADERS = [
  'Телефон',
  'ФИО',
  'Должность',
  'Отдел',
  'Стаж',
  'ID сотрудника',
  'Аванс (сум)',
  'Оператор',
  'Этап',
  'Карты',
  'Последний вывод',
  'Обновлено',
];

export function rowsFromEmployees(employees) {
  return employees.map(emp => [
    emp.phone,
    emp.fullName || '',
    emp.position || '',
    emp.department || '',
    emp.tenure || '',
    emp.employeeId || '',
    emp.advanceBalance ?? 0,
    emp.operator || '',
    getStageLabel(emp.stage),
    (emp.allowedCards || []).map(c => maskCard(c)).join(', '),
    emp.lastWithdrawal
      ? `${emp.lastWithdrawal.amount} · ${emp.lastWithdrawal.card} · ${emp.lastWithdrawal.at}`
      : '',
    emp.updatedAt || '',
  ]);
}
