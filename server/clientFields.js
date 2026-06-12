export const CLIENT_EDIT_FIELDS = [
  { key: 'name', label: 'Имя / ФИО', field: 'name' },
  { key: 'age', label: 'Возраст', field: 'age' },
  { key: 'marital', label: 'Семейное положение', field: 'marital' },
  { key: 'id', label: 'ID кабинета', field: 'id' },
  { key: 'balance', label: 'Аванс (сум)', field: 'balance' },
];

export function fieldLabel(key) {
  return CLIENT_EDIT_FIELDS.find(f => f.key === key)?.label || key;
}

export function isClientProfileComplete(emp) {
  if (!emp) return false;
  if (!String(emp.fullName || '').trim()) return false;
  if (emp.age === '' || emp.age === null || emp.age === undefined) return false;
  if (!String(emp.maritalStatus || '').trim()) return false;
  if (!String(emp.employeeId || '').trim()) return false;
  return true;
}

export function clientListButtonLabel(emp) {
  const name = emp.fullName || emp.phone;
  const mark = isClientProfileComplete(emp) ? '' : '⚠️ ';
  return `${mark}#${emp.clientId || '—'} · ${name}`.slice(0, 60);
}
