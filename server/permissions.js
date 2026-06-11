import { isAdmin } from './admins.js';
import { getOperatorByTelegramId, isOperator } from './operators.js';
import { getActiveDeskOperator } from './deskOperators.js';

export function getActor(telegramId, displayName = '') {
  const id = Number(telegramId);
  if (isAdmin(id)) {
    return { id, name: displayName || 'Admin', isAdmin: true };
  }
  const op = getOperatorByTelegramId(id);
  if (op) {
    return {
      id,
      name: op.name,
      isAdmin: false,
      operatorId: op.id,
      operatorName: op.name,
    };
  }
  return null;
}

export function hasStaffAccess(telegramId) {
  return isAdmin(telegramId) || isOperator(telegramId);
}

export function canExport(telegramId) {
  return isAdmin(telegramId);
}

export function canManageClient(telegramId, emp, deskOperatorName = '') {
  if (isAdmin(telegramId)) return true;
  if (!emp) return false;
  const name = String(deskOperatorName || getActiveDeskOperator(telegramId) || '').trim();
  const clientOperator = String(emp.operator || '').trim();
  if (clientOperator) return Boolean(name) && clientOperator === name;
  return emp.createdBy === Number(telegramId);
}

export function canViewClient(telegramId, emp, deskOperatorName = '') {
  return canManageClient(telegramId, emp, deskOperatorName);
}

export function canManageTagDefinitions(telegramId) {
  return hasStaffAccess(telegramId);
}
