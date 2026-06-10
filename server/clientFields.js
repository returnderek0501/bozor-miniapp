export const CLIENT_EDIT_FIELDS = [
  { key: 'name', label: 'Имя / ФИО', field: 'name' },
  { key: 'position', label: 'Должность', field: 'position' },
  { key: 'dept', label: 'Отдел', field: 'dept' },
  { key: 'tenure', label: 'Стаж', field: 'tenure' },
  { key: 'id', label: 'ID кабинета', field: 'id' },
  { key: 'balance', label: 'Аванс (сум)', field: 'balance' },
];

export function fieldLabel(key) {
  return CLIENT_EDIT_FIELDS.find(f => f.key === key)?.label || key;
}
