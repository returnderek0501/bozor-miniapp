import { join } from 'path';
import {
  DATA_DIR, readJson, writeJson, ensureDataDir, getDataDir,
} from './dataPath.js';
import { getTag } from './tags.js';
import { isAdmin } from './admins.js';
import { assignClientIdIfMissing } from './clientIds.js';

const PHONES_FILE = join(DATA_DIR, 'phones.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const EMPLOYEES_FILE = join(DATA_DIR, 'employees.json');

function triggerSync() {
  import('./export.js').then(m => m.scheduleDataSync()).catch(() => {});
}

export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  if (digits.length === 9 && digits.startsWith('9')) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  return null;
}

export function normalizeCard(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return null;
  return digits;
}

function defaultEmployee(phone) {
  return {
    phone,
    clientId: '',
    fullName: '',
    position: '',
    department: '',
    tenure: '',
    employeeId: '',
    advanceBalance: 0,
    operator: '',
    operatorId: '',
    tags: [],
    tagHistory: [],
    allowedCards: [],
    createdAt: null,
    createdBy: null,
    createdByName: '',
    updatedAt: new Date().toISOString(),
  };
}

function migrateEmployee(emp) {
  if (emp.stage && (!emp.tags || !emp.tags.length)) {
    const tag = getTag(emp.stage);
    const at = emp.updatedAt || new Date().toISOString();
    emp.tags = [{
      id: emp.stage,
      label: tag?.label || emp.stage,
      assignedAt: at,
      assignedBy: null,
      assignedByName: 'migratsiya',
    }];
    emp.tagHistory = [{
      id: emp.stage,
      label: tag?.label || emp.stage,
      action: 'add',
      at,
      by: null,
      byName: 'migratsiya',
    }];
    delete emp.stage;
  }
  if (!emp.tags) emp.tags = [];
  if (!emp.tagHistory) emp.tagHistory = [];
  if (!emp.clientId) assignClientIdIfMissing(emp);
  return emp;
}

export function listPhones() {
  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  return data.phones || [];
}

export function addPhone(raw, actor = null) {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami. Misol: +998901234567');

  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  const isNew = !data.phones.includes(phone);
  if (isNew) {
    data.phones.push(phone);
    data.phones.sort();
    data.updatedAt = new Date().toISOString();
    writeJson(PHONES_FILE, data);
  }

  const emp = getEmployee(phone);
  if (isNew && actor) {
    const all = readEmployees();
    const e = migrateEmployee(all[phone] || emp);
    const now = new Date().toISOString();
    assignClientIdIfMissing(e);
    e.createdAt = now;
    e.createdBy = actor.id;
    e.createdByName = actor.name;
    if (actor.operatorName) {
      e.operator = actor.operatorName;
      e.operatorId = actor.operatorId || '';
    }
    e.updatedAt = now;
    all[phone] = e;
    writeEmployees(all);
  } else if (isNew) {
    const all = readEmployees();
    const e = migrateEmployee(all[phone] || defaultEmployee(phone));
    assignClientIdIfMissing(e);
    all[phone] = e;
    writeEmployees(all);
  }
  return phone;
}

export function removePhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');

  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  data.phones = data.phones.filter(p => p !== phone);
  data.updatedAt = new Date().toISOString();
  writeJson(PHONES_FILE, data);
  triggerSync();
  return phone;
}

export function isPhoneAllowed(raw) {
  const phone = normalizePhone(raw);
  if (!phone) return false;
  return listPhones().includes(phone);
}

export function getSession(telegramId) {
  const sessions = readJson(SESSIONS_FILE, {});
  return sessions[String(telegramId)] || null;
}

export function setSession(telegramId, phone) {
  const sessions = readJson(SESSIONS_FILE, {});
  sessions[String(telegramId)] = {
    phone: normalizePhone(phone),
    verifiedAt: new Date().toISOString(),
  };
  writeJson(SESSIONS_FILE, sessions);
  return sessions[String(telegramId)];
}

function readEmployees() {
  return readJson(EMPLOYEES_FILE, {});
}

function writeEmployees(all) {
  writeJson(EMPLOYEES_FILE, all);
  triggerSync();
}

export function getEmployee(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const all = readEmployees();
  if (!all[phone]) {
    all[phone] = defaultEmployee(phone);
    writeEmployees(all);
    return all[phone];
  }
  const migrated = migrateEmployee({ ...all[phone] });
  if (JSON.stringify(migrated) !== JSON.stringify(all[phone])) {
    all[phone] = migrated;
    writeJson(EMPLOYEES_FILE, all);
  }
  return migrated;
}

export function listEmployees() {
  return listPhones().map(p => getEmployee(p));
}

export function listEmployeesForUser(telegramId) {
  const all = listEmployees();
  if (isAdmin(telegramId)) return all;
  return all.filter(e => e.createdBy === Number(telegramId));
}

export function findEmployeeByClientId(clientId) {
  const key = String(clientId || '').trim().toUpperCase();
  if (!key) return null;
  return listEmployees().find(e => e.clientId?.toUpperCase() === key) || null;
}

const EMPLOYEE_FIELDS = {
  name: 'fullName', ism: 'fullName', fio: 'fullName',
  position: 'position', lavozim: 'position',
  dept: 'department', bolim: 'department', bo_lim: 'department',
  tenure: 'tenure', staj: 'tenure',
  balance: 'advanceBalance', avans: 'advanceBalance',
  id: 'employeeId', empid: 'employeeId',
  operator: 'operator', oper: 'operator',
};

export function setEmployeeField(rawPhone, field, value) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');

  const mapped = EMPLOYEE_FIELDS[field.toLowerCase()];
  if (!mapped) {
    throw new Error('Noma\'lum maydon. Mavjud: name, position, dept, tenure, balance, id, operator');
  }

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));

  if (mapped === 'advanceBalance') {
    const num = Number(String(value).replace(/\s/g, ''));
    if (Number.isNaN(num)) throw new Error('Balans raqam bo\'lishi kerak');
    emp[mapped] = num;
  } else {
    emp[mapped] = value;
  }

  emp.updatedAt = new Date().toISOString();
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function setEmployeeOperator(rawPhone, operatorName, operatorId = '') {
  const phone = normalizePhone(rawPhone);
  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  emp.operator = String(operatorName || '').trim();
  emp.operatorId = operatorId || '';
  emp.updatedAt = new Date().toISOString();
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

function pushTagHistory(emp, entry) {
  emp.tagHistory = emp.tagHistory || [];
  emp.tagHistory.push(entry);
}

export function addClientTag(rawPhone, tagId, actor, photo = null) {
  const phone = normalizePhone(rawPhone);
  const tag = getTag(tagId);
  if (!phone) throw new Error('Noto\'g\'ri telefon');
  if (!tag) throw new Error(`Noma\'lum teg: ${tagId}`);
  if (!photo?.fileId) throw new Error('Teg uchun tasdiqlovchi foto yuborish shart');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  assignClientIdIfMissing(emp);
  const now = new Date().toISOString();
  const existing = emp.tags.find(t => t.id === tagId);
  const tagEntry = {
    id: tagId,
    label: tag.label,
    assignedAt: now,
    assignedBy: actor?.id ?? null,
    assignedByName: actor?.name || '',
    photo,
  };

  if (existing) {
    Object.assign(existing, tagEntry);
  } else {
    emp.tags.push(tagEntry);
  }

  pushTagHistory(emp, {
    id: tagId,
    label: tag.label,
    action: 'add',
    at: now,
    by: actor?.id ?? null,
    byName: actor?.name || '',
    photo,
  });

  emp.updatedAt = now;
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function removeClientTag(rawPhone, tagId, actor) {
  const phone = normalizePhone(rawPhone);
  const tag = getTag(tagId);
  if (!phone) throw new Error('Noto\'g\'ri telefon');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  const now = new Date().toISOString();
  const label = tag?.label || tagId;

  emp.tags = emp.tags.filter(t => t.id !== tagId);
  pushTagHistory(emp, {
    id: tagId,
    label,
    action: 'remove',
    at: now,
    by: actor?.id ?? null,
    byName: actor?.name || '',
  });

  emp.updatedAt = now;
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function getClientTag(emp, tagId) {
  return (emp.tags || []).find(t => t.id === tagId) || null;
}

export function hasClientTag(emp, tagId) {
  return (emp.tags || []).some(t => t.id === tagId);
}

export function addEmployeeCard(rawPhone, rawCard) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');
  if (!card) throw new Error('Noto\'g\'ri karta raqami');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  if (!emp.allowedCards.includes(card)) {
    emp.allowedCards.push(card);
    emp.allowedCards.sort();
  }
  emp.updatedAt = new Date().toISOString();
  all[phone] = emp;
  writeEmployees(all);
  return card;
}

export function removeEmployeeCard(rawPhone, rawCard) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');
  if (!card) throw new Error('Noto\'g\'ri karta raqami');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  emp.allowedCards = emp.allowedCards.filter(c => c !== card);
  emp.updatedAt = new Date().toISOString();
  all[phone] = emp;
  writeEmployees(all);
  return card;
}

export function isCardAllowed(rawPhone, rawCard) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone || !card) return false;
  return getEmployee(phone).allowedCards.includes(card);
}

export function withdrawAdvance(rawPhone, rawCard, amount) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone || !card) throw new Error('INVALID_DATA');
  if (!isCardAllowed(phone, card)) throw new Error('CARD_NOT_SUPPORTED');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  const sum = amount ? Number(amount) : emp.advanceBalance;

  if (Number.isNaN(sum) || sum <= 0) throw new Error('INVALID_AMOUNT');
  if (sum > emp.advanceBalance) throw new Error('INSUFFICIENT_BALANCE');

  emp.advanceBalance -= sum;
  emp.updatedAt = new Date().toISOString();
  emp.lastWithdrawal = {
    amount: sum,
    card: maskCard(card),
    at: new Date().toISOString(),
  };
  all[phone] = emp;
  writeEmployees(all);

  return { amount: sum, balance: emp.advanceBalance, card: maskCard(card) };
}

export { getDataDir, ensureDataDir };

export function maskCard(card) {
  if (!card || card.length < 8) return card;
  return `${card.slice(0, 4)} **** **** ${card.slice(-4)}`;
}

export function publicEmployee(emp, phoneMasked) {
  return {
    fullName: emp.fullName,
    position: emp.position,
    department: emp.department,
    tenure: emp.tenure,
    employeeId: emp.employeeId,
    advanceBalance: emp.advanceBalance,
    phone: phoneMasked,
    lastWithdrawal: emp.lastWithdrawal || null,
  };
}
