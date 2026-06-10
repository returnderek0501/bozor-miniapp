import { isAdmin } from './admins.js';
import { getOperatorByTelegramId, isOperator } from './operators.js';

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

function isAssignedOperator(telegramId, emp) {
  const op = getOperatorByTelegramId(telegramId);
  if (!op || !emp) return false;
  return emp.operatorId === op.id || emp.operator === op.name;
}

export function canManageClient(telegramId, emp) {
  if (isAdmin(telegramId)) return true;
  if (!emp) return false;
  return isAssignedOperator(telegramId, emp);
}

export function canViewClient(telegramId, emp) {
  return canManageClient(telegramId, emp);
}

export function canManageTagDefinitions(telegramId) {
  return hasStaffAccess(telegramId);
}
