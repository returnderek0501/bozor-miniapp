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
