import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';
import { listEmployees, resolvePhoneKey } from './store.js';
import { getOperatorById, getOperatorByName } from './operators.js';
import { findTelegramIdByDeskName } from './deskOperators.js';

const FILE = join(DATA_DIR, 'tag_reminders.json');
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const SCAN_INTERVAL_MS = 5 * 60 * 1000;
let scheduler = null;
let scanRunning = false;

function loadState() {
  return readJson(FILE, { byPhone: {}, updatedAt: null });
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  writeJson(FILE, state);
}

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function tagActivityAnchor(employee) {
  const timestamps = [
    Date.parse(employee.createdAt || employee.updatedAt || '') || 0,
    ...(employee.tagHistory || [])
      .filter(event => event.action !== 'remove')
      .map(event => Date.parse(event.at || '') || 0),
    ...(employee.tags || []).map(tag => Date.parse(tag.assignedAt || '') || 0),
  ];
  return Math.max(...timestamps);
}

export function isMoscowQuiet(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now));
  return hour < 6 || hour >= 20;
}

export function resolveReminderTarget(employee) {
  const byId = employee.operatorId ? getOperatorById(employee.operatorId) : null;
  if (byId?.telegramId) return Number(byId.telegramId);
  const byName = getOperatorByName(employee.operator);
  if (byName?.telegramId) return Number(byName.telegramId);
  const byDeskName = findTelegramIdByDeskName(employee.operator);
  if (byDeskName) return byDeskName;
  return employee.createdBy ? Number(employee.createdBy) : null;
}

export function reminderKeyboard(phone) {
  const digits = phoneDigits(phone);
  return {
    inline_keyboard: [
      [1, 4, 8].map(hours => ({
        text: `${hours} ч`,
        callback_data: `tr_snz:${hours}:${digits}`,
      })),
      [16, 24].map(hours => ({
        text: `${hours} ч`,
        callback_data: `tr_snz:${hours}:${digits}`,
      })).concat({ text: '✏️ Свой срок', callback_data: `tr_snz:custom:${digits}` }),
      [
        { text: '🔕 Игнорировать', callback_data: `tr_ign:${digits}` },
        { text: '👤 Открыть клиента', callback_data: `view_cl:${digits}` },
      ],
    ],
  };
}

function reminderMessage(employee, anchor, nowMs) {
  const inactiveHours = Math.max(2, Math.floor((nowMs - anchor) / (60 * 60 * 1000)));
  const tags = (employee.tags || []).map(tag => tag.label || tag.id).join(', ') || 'нет';
  return [
    '<b>⏰ По лиду давно не было новых тегов</b>',
    `Клиент: <b>${escapeHtml(employee.fullName || 'Имя не заполнено')}</b>`,
    `ID: <code>#${escapeHtml(employee.clientId || '—')}</code>`,
    `Телефон: <code>${escapeHtml(employee.phone)}</code>`,
    `Оператор: <b>${escapeHtml(employee.operator || employee.createdByName || '—')}</b>`,
    `Без новых тегов: <b>${inactiveHours} ч</b>`,
    `Текущие теги: ${escapeHtml(tags)}`,
    '',
    'Поставьте новый тег или выберите действие:',
  ].join('\n');
}

export function getTagReminderState(phone) {
  const key = resolvePhoneKey(phone);
  if (!key) return null;
  return loadState().byPhone[key] || null;
}

export function snoozeTagReminder(phone, hours, now = Date.now()) {
  const key = resolvePhoneKey(phone);
  const duration = Number(hours);
  if (!key || !Number.isInteger(duration) || duration < 1 || duration > 168) {
    throw new Error('INVALID_SNOOZE_HOURS');
  }
  const state = loadState();
  const entry = state.byPhone[key] || {};
  entry.ignored = false;
  entry.snoozedUntil = new Date(Number(now) + (duration * 60 * 60 * 1000)).toISOString();
  entry.nextReminderAt = entry.snoozedUntil;
  state.byPhone[key] = entry;
  saveState(state);
  return entry;
}

export function ignoreTagReminder(phone) {
  const key = resolvePhoneKey(phone);
  if (!key) throw new Error('INVALID_PHONE');
  const state = loadState();
  const entry = state.byPhone[key] || {};
  entry.ignored = true;
  entry.snoozedUntil = null;
  entry.nextReminderAt = null;
  state.byPhone[key] = entry;
  saveState(state);
  return entry;
}

export async function runTagReminderScan(bot, {
  now = Date.now(),
  employees = listEmployees(),
} = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const state = loadState();
  let notified = 0;

  for (const employee of employees) {
    const key = resolvePhoneKey(employee.phone);
    const anchor = tagActivityAnchor(employee);
    if (!key || !anchor) continue;
    const entry = state.byPhone[key] || {};
    if (entry.ignored) continue;

    const anchorIso = new Date(anchor).toISOString();
    const sameActivity = entry.lastAnchor === anchorIso;
    const scheduledAt = sameActivity
      ? Date.parse(entry.snoozedUntil || entry.nextReminderAt || '') || (anchor + TWO_HOURS_MS)
      : anchor + TWO_HOURS_MS;
    if (nowMs < scheduledAt) continue;

    const target = resolveReminderTarget(employee);
    if (!target) continue;
    const result = await bot.sendMessage(target, reminderMessage(employee, anchor, nowMs), {
      disable_notification: isMoscowQuiet(new Date(nowMs)),
      reply_markup: reminderKeyboard(employee.phone),
    });
    if (!result?.ok) {
      console.error(`Tag reminder failed for #${employee.clientId}:`, result?.description || 'unknown error');
      continue;
    }

    state.byPhone[key] = {
      ...entry,
      ignored: false,
      lastAnchor: anchorIso,
      lastNotifiedAt: new Date(nowMs).toISOString(),
      nextReminderAt: new Date(nowMs + TWO_HOURS_MS).toISOString(),
      snoozedUntil: null,
      targetTelegramId: target,
    };
    notified += 1;
  }

  if (notified) saveState(state);
  return { checked: employees.length, notified };
}

export function startTagReminderScheduler(bot) {
  if (scheduler) return scheduler;
  const scan = async () => {
    if (scanRunning) return;
    scanRunning = true;
    try {
      await runTagReminderScan(bot);
    } catch (error) {
      console.error('Tag reminder scan failed:', error.message);
    } finally {
      scanRunning = false;
    }
  };
  void scan();
  scheduler = setInterval(() => { void scan(); }, SCAN_INTERVAL_MS);
  scheduler.unref?.();
  return scheduler;
}
