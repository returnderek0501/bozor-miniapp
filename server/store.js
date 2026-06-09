import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (existsSync('/main')) return '/main';
  return join(__dirname, '..', 'data');
}

const DATA_DIR = resolveDataDir();
const PHONES_FILE = join(DATA_DIR, 'phones.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');
const EMPLOYEES_FILE = join(DATA_DIR, 'employees.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDataDir();
  writeFileSync(file, JSON.stringify(data, null, 2));
}

/** Normalize Uzbek phone to +998XXXXXXXXX */
export function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+998${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+${digits}`;
  }
  return null;
}

/** Normalize card number — digits only, 16 chars typical */
export function normalizeCard(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return null;
  return digits;
}

function defaultEmployee(phone) {
  return {
    phone,
    fullName: '',
    position: '',
    department: '',
    tenure: '',
    employeeId: '',
    advanceBalance: 0,
    allowedCards: [],
    updatedAt: new Date().toISOString(),
  };
}

export function listPhones() {
  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  return data.phones || [];
}

export function addPhone(raw) {
  const phone = normalizePhone(raw);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami. Misol: +998901234567');

  const data = readJson(PHONES_FILE, { phones: [], updatedAt: null });
  if (!data.phones.includes(phone)) {
    data.phones.push(phone);
    data.phones.sort();
    data.updatedAt = new Date().toISOString();
    writeJson(PHONES_FILE, data);
    getEmployee(phone);
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
}

export function getEmployee(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const all = readEmployees();
  if (!all[phone]) {
    all[phone] = defaultEmployee(phone);
    writeEmployees(all);
  }
  return all[phone];
}

export function listEmployees() {
  const phones = listPhones();
  return phones.map(p => getEmployee(p));
}

const EMPLOYEE_FIELDS = {
  name: 'fullName',
  ism: 'fullName',
  fio: 'fullName',
  position: 'position',
  lavozim: 'position',
  dept: 'department',
  bolim: 'department',
  bo_lim: 'department',
  tenure: 'tenure',
  staj: 'tenure',
  balance: 'advanceBalance',
  avans: 'advanceBalance',
  id: 'employeeId',
  empid: 'employeeId',
};

export function setEmployeeField(rawPhone, field, value) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');

  const mapped = EMPLOYEE_FIELDS[field.toLowerCase()];
  if (!mapped) {
    throw new Error(`Noma\'lum maydon: ${field}. Mavjud: name, position, dept, tenure, balance, id`);
  }

  const all = readEmployees();
  const emp = all[phone] || defaultEmployee(phone);

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

export function addEmployeeCard(rawPhone, rawCard) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone) throw new Error('Noto\'g\'ri telefon raqami');
  if (!card) throw new Error('Noto\'g\'ri karta raqami');

  const all = readEmployees();
  const emp = all[phone] || defaultEmployee(phone);
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
  const emp = all[phone] || defaultEmployee(phone);
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
  const emp = getEmployee(phone);
  return emp.allowedCards.includes(card);
}

export function withdrawAdvance(rawPhone, rawCard, amount) {
  const phone = normalizePhone(rawPhone);
  const card = normalizeCard(rawCard);
  if (!phone || !card) {
    throw new Error('INVALID_DATA');
  }
  if (!isCardAllowed(phone, card)) {
    throw new Error('CARD_NOT_SUPPORTED');
  }

  const all = readEmployees();
  const emp = all[phone] || defaultEmployee(phone);
  const sum = amount ? Number(amount) : emp.advanceBalance;

  if (Number.isNaN(sum) || sum <= 0) {
    throw new Error('INVALID_AMOUNT');
  }
  if (sum > emp.advanceBalance) {
    throw new Error('INSUFFICIENT_BALANCE');
  }

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

export function getDataDir() {
  return DATA_DIR;
}

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
