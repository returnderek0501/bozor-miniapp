import { join } from 'path';
import {
  DATA_DIR, readJson, writeJson, ensureDataDir, getDataDir,
} from './dataPath.js';
import { getTag, slugify } from './tags.js';
import { isAdmin } from './admins.js';
import { assignClientIdIfMissing, normalizeClientId } from './clientIds.js';

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

/** Для оператора/админа при добавлении клиента: любой номер с кодом +998 */
export function normalizePhoneForOperator(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('998')) {
    const local = digits.slice(3);
    if (!local) return null;
    return `+998${local}`;
  }

  return `+998${digits}`;
}

export function resolvePhoneKey(raw) {
  return normalizePhone(raw) || normalizePhoneForOperator(raw);
}

export function normalizeCard(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return null;
  return digits;
}

function assignActorToClient(emp, actor) {
  if (!actor) return;
  emp.createdBy = actor.id;
  const opName = actor.deskOperatorName || actor.operatorName || actor.name || '';
  emp.createdByName = opName;
  emp.operator = opName;
  emp.operatorId = actor.operatorId || '';
}

const FIXED_POSITION = 'Agent';

function defaultEmployee(phone) {
  return {
    phone,
    clientId: '',
    fullName: '',
    position: FIXED_POSITION,
    age: '',
    maritalStatus: '',
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
    kycStatus: 'none',
    kycSubmittedAt: null,
    kycReviewedAt: null,
    kycReviewedBy: null,
    kycReviewedByName: '',
    kycRejectionReason: '',
    kycDocuments: { idCardFront: null, idCardBack: null, selfie: null },
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
  if (!emp.allowedCards) emp.allowedCards = [];
  if (!emp.clientId) assignClientIdIfMissing(emp);
  if (!emp.kycStatus) emp.kycStatus = 'none';
  if (!emp.kycDocuments) emp.kycDocuments = { idCardFront: null, idCardBack: null, selfie: null };
  if (emp.kycDocuments.idCard && !emp.kycDocuments.idCardFront) {
    emp.kycDocuments.idCardFront = emp.kycDocuments.idCard;
    delete emp.kycDocuments.idCard;
  }
  if (!('idCardFront' in emp.kycDocuments)) emp.kycDocuments.idCardFront = null;
  if (!('idCardBack' in emp.kycDocuments)) emp.kycDocuments.idCardBack = null;
  if (!('selfie' in emp.kycDocuments)) emp.kycDocuments.selfie = null;
  emp.position = FIXED_POSITION;
  if (emp.age === undefined || emp.age === null) emp.age = '';
  if (emp.maritalStatus === undefined || emp.maritalStatus === null) emp.maritalStatus = '';
  return emp;
}

export function listPhones() {
  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  return data.phones || [];
}

export function addPhone(raw, actor = null) {
  const phone = normalizePhoneForOperator(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami. Raqam +998 kodini o\'z ichiga olishi kerak. Misol: +998901234567');

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
    assignActorToClient(e, actor);
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
  const phone = normalizePhone(raw) || normalizePhoneForOperator(raw);
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

function readAllSessions() {
  return readJson(SESSIONS_FILE, {});
}

export function listTelegramIdsForPhones(phones) {
  const wanted = new Set(phones);
  const sessions = readAllSessions();
  const ids = [];
  for (const [tid, s] of Object.entries(sessions)) {
    if (s?.phone && wanted.has(s.phone)) ids.push(Number(tid));
  }
  return ids;
}

export function listAllClientTelegramIds() {
  return Object.keys(readAllSessions()).map(Number);
}

export function getTelegramIdByPhone(phone) {
  const normalized = normalizePhone(phone);
  const sessions = readAllSessions();
  for (const [tid, s] of Object.entries(sessions)) {
    if (s?.phone === normalized) return Number(tid);
  }
  return null;
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
  const phone = normalizePhone(rawPhone) || normalizePhoneForOperator(rawPhone);
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

export function listEmployeesForUser(telegramId, deskOperatorName = '') {
  const all = listEmployees();
  if (isAdmin(telegramId)) return all;
  const name = String(deskOperatorName || '').trim();
  if (name) return all.filter(e => e.operator === name);
  return all.filter(e => e.createdBy === Number(telegramId));
}

export function findEmployeeByClientId(clientId) {
  const key = normalizeClientId(clientId);
  if (!key) return null;
  return listEmployees().find(e => String(e.clientId) === String(key)) || null;
}

const EMPLOYEE_FIELDS = {
  name: 'fullName', ism: 'fullName', fio: 'fullName',
  age: 'age', yosh: 'age',
  marital: 'maritalStatus', maritalstatus: 'maritalStatus', family: 'maritalStatus',
  balance: 'advanceBalance', avans: 'advanceBalance',
  id: 'employeeId', empid: 'employeeId',
  operator: 'operator', oper: 'operator',
};

export function setEmployeeField(rawPhone, field, value) {
  const phone = resolvePhoneKey(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');

  const mapped = EMPLOYEE_FIELDS[field.toLowerCase()];
  if (!mapped) {
    throw new Error('Noma\'lum maydon. Mavjud: name, age, marital, balance, id, operator');
  }

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));

  if (mapped === 'advanceBalance' || mapped === 'age') {
    const num = Number(String(value).replace(/\s/g, ''));
    if (Number.isNaN(num)) throw new Error(mapped === 'age' ? 'Yosh raqam bo\'lishi kerak' : 'Balans raqam bo\'lishi kerak');
    if (mapped === 'age' && (num < 1 || num > 120)) throw new Error('Yosh 1–120 oralig\'ida bo\'lishi kerak');
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
  const phone = resolvePhoneKey(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');
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

export function addClientTag(rawPhone, tagId, actor, extras = null) {
  const tag = getTag(tagId);
  if (!tag) throw new Error(`Noma\'lum teg: ${tagId}`);
  return addClientTagInternal(rawPhone, tagId, tag.label, actor, extras);
}

export function addClientTagFreeform(rawPhone, label, actor, extras = null) {
  const trimmed = String(label || '').trim();
  if (!trimmed) throw new Error('Тег не может быть пустым');
  const tagId = `custom_${slugify(trimmed)}`;
  return addClientTagInternal(rawPhone, tagId, trimmed, actor, extras);
}

function addClientTagInternal(rawPhone, tagId, label, actor, extras = null) {
  const phone = resolvePhoneKey(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon');

  const photo = extras?.photo || null;
  const note = extras?.note ? String(extras.note).trim() : '';

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  assignClientIdIfMissing(emp);
  const now = new Date().toISOString();
  const existing = emp.tags.find(t => t.id === tagId);

  if (existing) {
    existing.label = label;
    existing.assignedAt = now;
    existing.assignedBy = actor?.id ?? null;
    existing.assignedByName = actor?.name || '';
    if (photo) existing.photo = photo;
    if (note) existing.note = note;
  } else {
    const entry = {
      id: tagId,
      label,
      assignedAt: now,
      assignedBy: actor?.id ?? null,
      assignedByName: actor?.name || '',
      note: note || '',
    };
    if (photo) entry.photo = photo;
    emp.tags.push(entry);
  }

  let action = 'add';
  if (photo && note) action = 'add_note_photo';
  else if (photo) action = 'photo';
  else if (note) action = 'note';

  const historyEntry = {
    id: tagId,
    label,
    action,
    at: now,
    by: actor?.id ?? null,
    byName: actor?.name || '',
  };
  if (photo) historyEntry.photo = photo;
  if (note) historyEntry.note = note;
  pushTagHistory(emp, historyEntry);

  emp.updatedAt = now;
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function removeClientTag(rawPhone, tagId, actor) {
  const phone = resolvePhoneKey(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  const now = new Date().toISOString();
  const existing = emp.tags.find(t => t.id === tagId);
  const label = existing?.label || getTag(tagId)?.label || tagId;

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

export function isCardAllowed(rawPhone, rawCard) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone || !card) return false;
  return getEmployee(phone).allowedCards.includes(card);
}

export function isKycApproved(rawPhone) {
  const emp = getEmployee(rawPhone);
  return emp?.kycStatus === 'approved';
}

export function submitKyc(rawPhone, documents) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('INVALID_DATA');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  if (emp.kycStatus === 'pending') throw new Error('KYC_PENDING');
  if (emp.kycStatus === 'approved') throw new Error('KYC_ALREADY_APPROVED');
  if (!documents?.idCardFront?.path || !documents?.idCardBack?.path || !documents?.selfie?.path) {
    throw new Error('KYC_DOCUMENTS_REQUIRED');
  }

  const now = new Date().toISOString();
  emp.kycDocuments = documents;
  emp.kycStatus = 'pending';
  emp.kycSubmittedAt = now;
  emp.kycRejectionReason = '';
  emp.kycReviewedAt = null;
  emp.kycReviewedBy = null;
  emp.kycReviewedByName = '';
  emp.updatedAt = now;
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function setKycStatus(rawPhone, status, reviewer = null, reason = '') {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('INVALID_DATA');
  const allowed = new Set(['approved', 'rejected']);
  if (!allowed.has(status)) throw new Error('INVALID_KYC_STATUS');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  if (emp.kycStatus !== 'pending') throw new Error('KYC_NOT_PENDING');

  const now = new Date().toISOString();
  emp.kycStatus = status;
  emp.kycReviewedAt = now;
  emp.kycReviewedBy = reviewer?.id ?? null;
  emp.kycReviewedByName = reviewer?.deskOperatorName || reviewer?.name || reviewer?.operatorName || '';
  if (status === 'rejected') {
    emp.kycRejectionReason = String(reason || '').trim() || 'Отклонено оператором';
  } else {
    emp.kycRejectionReason = '';
  }
  emp.updatedAt = now;
  all[phone] = emp;
  writeEmployees(all);
  return emp;
}

export function withdrawAdvance(rawPhone, rawCard, amount) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone || !card) throw new Error('INVALID_DATA');
  if (!isCardAllowed(phone, card)) throw new Error('CARD_NOT_SUPPORTED');

  const all = readEmployees();
  const emp = migrateEmployee(all[phone] || defaultEmployee(phone));
  if (emp.kycStatus !== 'approved') throw new Error('KYC_NOT_APPROVED');
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
  const kycStatus = emp.kycStatus || 'none';
  return {
    fullName: emp.fullName,
    position: FIXED_POSITION,
    age: emp.age ?? '',
    maritalStatus: emp.maritalStatus ?? '',
    employeeId: emp.employeeId,
    advanceBalance: emp.advanceBalance,
    phone: phoneMasked,
    lastWithdrawal: emp.lastWithdrawal || null,
    kycStatus,
    kycRejectionReason: emp.kycRejectionReason || '',
    kycCanSubmit: kycStatus === 'none' || kycStatus === 'rejected',
    withdrawAllowed: kycStatus === 'approved',
  };
}
