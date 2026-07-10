import {
  addPhone,
  getEmployee, setEmployeeField, listEmployeesForUser, findEmployeeByClientId,
  normalizePhoneForOperator, resolvePhoneKey, getClientTag,
  addClientTag, removeClientTag, addClientTagFreeform,
  setEmployeeOperator,
  listTelegramIdsForPhones, getTelegramIdByPhone,
  setKycStatus,
} from './store.js';
import { isAdmin, listAdmins, addAdmin, isEnvAdmin } from './admins.js';
import { listOperators, addOperatorByTelegramId } from './operators.js';
import { listTags, listTagsForUser, addTag, formatTagTime, GLOBAL_TAG_COUNT } from './tags.js';
import {
  getActor, hasStaffAccess, canExport, canManageClient, canViewClient,
} from './permissions.js';
import { buildExcelBuffer, getExportFilename } from './export.js';
import { isSheetsConfigured } from './sheets.js';
import { createBotApi } from './telegram.js';
import { saveTelegramFile, attachmentAbsolutePath } from './attachments.js';
import { pending, clearAllPending } from './pending.js';
import { todayClientsSummary, operatorStatsSummary } from './stats.js';
import {
  createBroadcastRequest, approveBroadcast, markBroadcastSent,
  resolveBroadcastRecipients, formatBroadcastApproval,
} from './broadcasts.js';
import { CLIENT_EDIT_FIELDS, clientListButtonLabel, isClientProfileComplete } from './clientFields.js';
import {
  getActiveDeskOperator, listRecentDeskNames, rememberDeskOperatorName, enrichActorWithDesk,
} from './deskOperators.js';
import {
  setKycBot, sendKycDocumentsToChat, notifyClientKycResult, kycStatusLabel,
} from './kyc.js';
import {
  isPanelSecretConfigured, matchesPanelSecret, unlockPanel, lockPanel, isPanelUnlocked,
} from './panelAccess.js';

function normalizeCmd(text) {
  return String(text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
}

function ik(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

function matchCmd(text, ...cmds) {
  const c = normalizeCmd(text);
  return cmds.includes(c);
}

function deskName(fromId) {
  return getActiveDeskOperator(fromId);
}

function buildActor(fromId, displayName, overrideName = null) {
  return enrichActorWithDesk(getActor(fromId, displayName), fromId, overrideName);
}

function operatorPanelTitle(fromId) {
  const n = deskName(fromId);
  return n
    ? `<b>Панель оператора</b>\n👤 Сейчас: <b>${n}</b>`
    : '<b>Панель оператора</b>\n<i>Укажите имя оператора</i>';
}

async function openStaffPanel(bot, chatId, fromId) {
  if (!hasStaffAccess(fromId)) return false;
  clearAllPending(chatId);
  if (isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Панель администратора</b>', adminKeyboard());
  } else {
    await bot.sendMessage(chatId, operatorPanelTitle(fromId), operatorKeyboard());
    if (!deskName(fromId) && listRecentDeskNames(fromId).length) {
      await bot.sendMessage(chatId, 'Выберите имя для этой смены:', operatorNamePickerKeyboard(fromId, 'set'));
    }
  }
  return true;
}

function operatorNamePickerKeyboard(telegramId, mode = 'set') {
  const names = listRecentDeskNames(telegramId);
  const prefix = mode === 'add' ? 'desk_add' : 'desk_set';
  const rows = [];
  for (let i = 0; i < names.length; i += 2) {
    const row = [{ text: names[i], callback_data: `${prefix}:${i}` }];
    if (names[i + 1]) row.push({ text: names[i + 1], callback_data: `${prefix}:${i + 1}` });
    rows.push(row);
  }
  rows.push([{ text: '✏️ Другое имя', callback_data: `${prefix}:custom` }]);
  if (mode === 'set') rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return ik(rows);
}

async function finishAddClient(bot, chatId, fromId, phone, operatorName, displayName) {
  rememberDeskOperatorName(fromId, operatorName);
  const actor = buildActor(fromId, displayName, operatorName);
  addPhone(phone, actor);
  const emp = getEmployee(phone);
  pending.addClient.delete(chatId);
  await bot.sendMessage(chatId, [
    `✅ Клиент #<code>${emp.clientId}</code>`,
    `Тел: <code>${phone}</code>`,
    `Оператор: <b>${operatorName}</b>`,
  ].join('\n'), employeeActionsKeyboard(phone, fromId));
}

// ─── Keyboards ───────────────────────────────────────────────────────────────

function panelKeyboard(telegramId) {
  return isAdmin(telegramId) ? adminKeyboard() : operatorKeyboard();
}

function adminKeyboard() {
  return ik([
    [{ text: '👤 Клиенты', callback_data: 'adm_clients' }, { text: '➕ Клиент', callback_data: 'adm_add' }],
    [{ text: '🔍 Поиск по ID', callback_data: 'adm_find' }, { text: '🏷 Теги', callback_data: 'adm_tag_menu' }],
    [{ text: '📅 Сегодня', callback_data: 'sum_today' }, { text: '📊 Сводка оп.', callback_data: 'sum_ops' }],
    [{ text: '✉️ Рассылка', callback_data: 'bc_menu' }, { text: '📊 Экспорт', callback_data: 'admin_export' }],
    [{ text: '👔 Операторы', callback_data: 'staff_ops' }, { text: '🔑 Админы', callback_data: 'staff_admins' }],
    [{ text: '🏷 Справочник тегов', callback_data: 'admin_tags' }, { text: 'ℹ️ Помощь', callback_data: 'admin_help' }],
  ]);
}

function operatorKeyboard() {
  return ik([
    [{ text: '👤 Мои клиенты', callback_data: 'op_clients' }, { text: '➕ Клиент', callback_data: 'op_add' }],
    [{ text: '🔍 Поиск по ID', callback_data: 'op_find' }, { text: '🏷 Теги', callback_data: 'op_tag_menu' }],
    [{ text: '📅 Сегодня', callback_data: 'sum_today' }, { text: '✉️ Сообщение клиенту', callback_data: 'bc_by_id' }],
    [{ text: '👤 Кто я / сменить', callback_data: 'desk_switch' }],
    [{ text: '🏷 Справочник тегов', callback_data: 'admin_tags' }, { text: 'ℹ️ Помощь', callback_data: 'op_help' }],
  ]);
}

function staffOpsKeyboard() {
  return ik([
    [{ text: '➕ Добавить по Telegram ID', callback_data: 'staff_add_op' }],
    [{ text: '📋 Список', callback_data: 'admin_operators' }],
    [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
  ]);
}

function staffAdminsKeyboard() {
  return ik([
    [{ text: '➕ Добавить админа', callback_data: 'staff_add_admin' }],
    [{ text: '📋 Список', callback_data: 'admin_admins' }],
    [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
  ]);
}

function broadcastMenuKeyboard(telegramId) {
  if (!isAdmin(telegramId)) {
    return ik([
      [{ text: '👤 Клиенту по ID', callback_data: 'bc_by_id' }],
      [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
    ]);
  }
  return ik([
    [{ text: '👤 Одному (по ID)', callback_data: 'bc_by_id' }],
    [{ text: '👥 Всем моим', callback_data: 'bc_mine' }],
    [{ text: '🌐 Всем (с подтв.)', callback_data: 'bc_all' }],
    [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
  ]);
}

function tagAddPromptKeyboard() {
  return ik([
    [{ text: '✓ Без вложений', callback_data: 'tag_skip' }],
    [{ text: '✕ Отмена', callback_data: 'tag_cancel' }],
  ]);
}

const CLIENT_PAGE_SIZE = 15;

function clientListHeader(telegramId, count, { allowIdInput = false, incompleteCount = 0 } = {}) {
  const title = isAdmin(telegramId) ? 'Все клиенты' : 'Мои клиенты';
  const lines = [`<b>${title} (${count})</b>`, '', 'Выберите клиента кнопкой'];
  if (allowIdInput) {
    lines.push('или отправьте <b>ID клиента</b> (например <code>5</code>).');
  } else {
    lines.push('ниже:');
  }
  if (incompleteCount > 0) {
    lines.push('', `⚠️ Недозаполненных: <b>${incompleteCount}</b> (помечены ⚠️)`);
  }
  return lines.join('\n');
}

function clientListKeyboard(employees, prefix, page = 0) {
  const start = page * CLIENT_PAGE_SIZE;
  const slice = employees.slice(start, start + CLIENT_PAGE_SIZE);
  const rows = slice.map(e => [{
    text: clientListButtonLabel(e),
    callback_data: `${prefix}:${phoneDigits(e.phone)}`,
  }]);
  if (!rows.length) rows.push([{ text: '— пусто —', callback_data: 'noop' }]);
  const nav = [];
  if (page > 0) nav.push({ text: '◀️ Назад', callback_data: `cl_list:${prefix}:${page - 1}` });
  if (start + CLIENT_PAGE_SIZE < employees.length) {
    nav.push({ text: 'Далее ▶️', callback_data: `cl_list:${prefix}:${page + 1}` });
  }
  if (nav.length) rows.push(nav);
  rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return ik(rows);
}

function pickOrTypeKeyboard(mode) {
  const pickData = mode === 'bc' ? 'bc_pick' : 'find_pick';
  const typeData = mode === 'bc' ? 'bc_type' : 'find_type';
  return ik([
    [{ text: '📋 Выбрать из списка', callback_data: pickData }],
    [{ text: '✏️ Ввести ID или телефон', callback_data: typeData }],
    [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
  ]);
}

function clientOperatorPickerKeyboard(phone, telegramId) {
  const digits = phoneDigits(phone);
  const names = listRecentDeskNames(telegramId);
  const rows = names.map((name, i) => ([{
    text: name,
    callback_data: `op_set:${i}:${digits}`,
  }]));
  rows.push([{ text: '✏️ Другое имя', callback_data: `op_set:custom:${digits}` }]);
  rows.push([{ text: '◀️ К клиенту', callback_data: `view_cl:${digits}` }]);
  return ik(rows);
}

function employeeActionsKeyboard(phone, telegramId) {
  const digits = phoneDigits(phone);
  const rows = [
    [
      { text: '✏️ Данные', callback_data: `edit_cl:${digits}` },
      { text: '🏷 Теги', callback_data: `pick_tg:${digits}` },
    ],
    [
      { text: '👤 Оператор', callback_data: `op_chg:${digits}` },
    ],
    [
      { text: '📎 Фото тегов', callback_data: `tag_photos:${digits}` },
      { text: '✉️ Написать', callback_data: `bc_cl:${digits}` },
    ],
    [
      { text: '🪪 KYC', callback_data: `kyc_view:${digits}` },
    ],
  ];
  if (isAdmin(telegramId)) {
    rows.push([{ text: '📷 Все фото', callback_data: `client_photos:${digits}` }]);
  }
  rows.push([{ text: '◀️ Панель', callback_data: isAdmin(telegramId) ? 'adm_panel' : 'op_panel' }]);
  return ik(rows);
}

function clientEditKeyboard(phone) {
  const digits = phoneDigits(phone);
  const rows = CLIENT_EDIT_FIELDS.map(f => ([{
    text: f.label,
    callback_data: `edit_f:${f.key}:${digits}`,
  }]));
  rows.push([{ text: '◀️ К клиенту', callback_data: `view_cl:${digits}` }]);
  return ik(rows);
}

function clientPickerKeyboard(employees, prefix) {
  return clientListKeyboard(employees, prefix, 0);
}

function tagPickerKeyboard(phone, emp, telegramId) {
  const digits = phoneDigits(phone);
  const tags = listTagsForUser(telegramId);
  const rows = tags.map(t => {
    const existing = getClientTag(emp, t.id);
    if (existing) {
      const extras = [];
      if (existing.note) extras.push('текст');
      if (existing.photo) extras.push('фото');
      const suffix = extras.length ? ` (${extras.join(', ')})` : '';
      return [{ text: `✓ ${t.label}${suffix}`, callback_data: `tag_open:${t.id}:${digits}` }];
    }
    return [{ text: `+ ${t.label}`, callback_data: `tag_sel:${t.id}:${digits}` }];
  });
  rows.push([{ text: '◀️ К клиенту', callback_data: `view_cl:${digits}` }]);
  return ik(rows);
}

function tagOpenKeyboard(phone, emp, tagId, telegramId) {
  const digits = phoneDigits(phone);
  const tag = getClientTag(emp, tagId);
  const rows = [];
  if (tag?.photo) rows.push([{ text: '📎 Смотреть фото', callback_data: `tag_view:${tagId}:${digits}` }]);
  if (tag?.note) rows.push([{ text: '📝 Текст заметки', callback_data: `tag_note:${tagId}:${digits}` }]);
  if (canManageClient(telegramId, emp)) {
    rows.push([{ text: '✕ Снять тег', callback_data: `tag_rm:${tagId}:${digits}` }]);
  }
  rows.push([{ text: '◀️ К тегам', callback_data: `pick_tg:${digits}` }]);
  return ik(rows);
}

function tagPhotosKeyboard(phone, emp) {
  const digits = phoneDigits(phone);
  const tagged = (emp.tags || []).filter(t => t.photo?.path || t.photo?.fileId);
  const rows = tagged.map(t => [{
    text: `📎 ${t.label}`,
    callback_data: `tag_view:${t.id}:${digits}`,
  }]);
  if (!rows.length) rows.push([{ text: '— нет фото —', callback_data: 'noop' }]);
  rows.push([{ text: '◀️ Назад', callback_data: `view_cl:${digits}` }]);
  return ik(rows);
}

function tagsCatalogKeyboard(telegramId) {
  const rows = [[{ text: '➕ Добавить тег', callback_data: 'tag_add_new' }]];
  rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return ik(rows);
}

function miniAppReplyKeyboard() {
  const url = process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app';
  return {
    keyboard: [[{ text: '📱 Shaxsiy kabinetni ochish', web_app: { url } }]],
    resize_keyboard: true,
  };
}

function miniAppInlineKeyboard() {
  const url = process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app';
  return ik([[{ text: '📱 Shaxsiy kabinet', web_app: { url } }]]);
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatMoney(n) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

function phoneDigits(phone) {
  return resolvePhoneKey(phone)?.replace(/\D/g, '') || '';
}

function formatTagsList(emp) {
  if (!emp.tags?.length) return '—';
  return emp.tags.map(t => {
    const parts = [`• ${t.label} <i>(${formatTagTime(t.assignedAt)})</i>`];
    if (t.note) parts.push(`  <i>${t.note}</i>`);
    if (t.photo) parts.push('  📎 фото');
    return parts.join('\n');
  }).join('\n');
}

function formatEmployee(emp) {
  const operator = emp.operator || emp.createdByName || '—';
  const kyc = kycStatusLabel(emp.kycStatus || 'none');

  return [
    `<b>Клиент: ${emp.fullName || '—'}</b>`,
    `ID: <b>#${emp.clientId || '—'}</b>`,
    `Телефон: <code>${emp.phone}</code>`,
    `Оператор: <b>${operator}</b>`,
    `KYC: <b>${kyc}</b>`,
    `Теги:\n${formatTagsList(emp)}`,
    `Должность: Agent`,
    `Возраст: ${emp.age ?? '—'}`,
    `Семейное положение: ${emp.maritalStatus || '—'}`,
    `ID кабинета: ${emp.employeeId || '—'}`,
    `Аванс: ${formatMoney(emp.advanceBalance)} сум`,
    `Добавлен: ${emp.createdAt ? formatTagTime(emp.createdAt) : '—'}`,
  ].join('\n');
}

function formatEmployeesList(telegramId) {
  const employees = listEmployeesForUser(telegramId, deskName(telegramId));
  if (!employees.length) return 'Список пуст.';
  const title = isAdmin(telegramId) ? 'Все клиенты' : 'Мои клиенты';
  return [
    `<b>${title} (${employees.length})</b>`,
    '',
    ...employees.map(e => {
      const tags = e.tags?.map(t => t.label).join(', ') || '—';
      return `• #<code>${e.clientId || '—'}</code> ${e.fullName || e.phone} | ${e.operator || '—'} | ${tags}`;
    }),
  ].join('\n');
}

function formatOperatorsList() {
  const ops = listOperators();
  if (!ops.length) return 'Операторы пусты.';
  return [
    `<b>Аккаунты операторов (${ops.length})</b>`,
    '<i>Имя на смене каждый задаёт сам: 👤 Кто я / сменить</i>',
    '',
    ...ops.map(o =>
      o.telegramId
        ? `• <code>${o.telegramId}</code>`
        : `• <b>${o.name}</b> — Telegram не привязан`,
    ),
  ].join('\n');
}

function formatAdminsList() {
  return [
    `<b>Админы (${listAdmins().length})</b>`,
    '',
    ...listAdmins().map(id => `• <code>${id}</code>${isEnvAdmin(id) ? ' (ENV)' : ''}`),
  ].join('\n');
}

function formatTagsCatalog(telegramId) {
  const tags = listTagsForUser(telegramId);
  const lines = tags.map(t => {
    const scope = t.scope === 'operator' ? ' <i>(ваш)</i>' : '';
    return `• <code>${t.id}</code> — ${t.label}${scope}`;
  });
  return [
    `<b>Теги (${tags.length})</b>`,
    `Первые ${GLOBAL_TAG_COUNT} — общие для всех.`,
    '',
    ...lines,
    '',
    '<i>Оператор добавляет тег только для себя. Админ — для всех.</i>',
  ].join('\n');
}

function adminHelpText() {
  return 'Управление — кнопками в панели. /admin — панель администратора.';
}

function operatorHelpText() {
  return [
    'Управление — кнопками в панели. /panel — панель оператора.',
    '',
    '<b>Клиенты:</b> 👤 Мои клиенты — выбор кнопкой или отправка ID.',
    '⚠️ — недозаполненный профиль (имя, возраст, сем. положение, ID кабинета).',
    '👤 Оператор — смена на карточке клиента.',
    '',
    'На общем аккаунте: <b>👤 Кто я / сменить</b> — выбрать имя оператора.',
    'При добавлении клиента укажите, кто его ведёт — имя сохранится для быстрого выбора.',
  ].join('\n');
}

function ensureDeskOperatorForList(fromId) {
  if (isAdmin(fromId)) return true;
  if (deskName(fromId)) return true;
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveClientQuery(query, telegramId) {
  const q = String(query || '').trim();
  let emp = null;
  if (/^\d+$/.test(q) || /^CLT-/i.test(q)) {
    emp = findEmployeeByClientId(q);
  } else {
    emp = getEmployee(q);
  }
  if (!emp?.phone) throw new Error('Клиент не найден');
  if (!canViewClient(telegramId, emp, deskName(telegramId))) throw new Error('Нет доступа');
  return emp;
}

function resolveClientQueryForList(query, telegramId) {
  const q = String(query || '').trim();
  let emp = null;
  if (/^\d+$/.test(q) || /^CLT-/i.test(q)) {
    emp = findEmployeeByClientId(q);
  } else {
    emp = getEmployee(q);
  }
  if (!emp?.phone) throw new Error('Клиент не найден');
  if (canViewClient(telegramId, emp, deskName(telegramId))) return emp;
  const opName = emp.operator || emp.createdByName || 'другим оператором';
  throw new Error(`Это клиент, закреплённый за оператором <b>${opName}</b>, а не за вами.`);
}

function requireClientAccess(fromId, phone) {
  const emp = getEmployee(phone);
  if (!canManageClient(fromId, emp, deskName(fromId))) throw new Error('Нет доступа к клиенту');
  return emp;
}

const KYC_REJECTION_REASONS = {
  blur: 'Фото размыто или нечитаемо',
  data: 'Данные документа не видны',
  crop: 'Документ обрезан или закрыт',
  selfie: 'Селфи не соответствует требованиям',
};

function kycRejectionKeyboard(phone) {
  const digits = phoneDigits(phone);
  return ik([
    [{ text: '🌫 Фото размыто', callback_data: `kyc_reason:blur:${digits}` }],
    [{ text: '🔎 Не видны данные', callback_data: `kyc_reason:data:${digits}` }],
    [{ text: '✂️ Документ обрезан', callback_data: `kyc_reason:crop:${digits}` }],
    [{ text: '🤳 Проблема с селфи', callback_data: `kyc_reason:selfie:${digits}` }],
    [{ text: '✏️ Другая причина', callback_data: `kyc_reason:other:${digits}` }],
  ]);
}

async function rejectKyc(bot, chatId, fromId, displayName, phone, reason) {
  const emp = requireClientAccess(fromId, phone);
  if (emp.kycStatus !== 'pending') throw new Error('KYC уже обработан');
  const reviewer = buildActor(fromId, displayName || '');
  const updated = setKycStatus(phone, 'rejected', reviewer, reason);
  pending.kycReject.delete(chatId);
  await bot.sendMessage(chatId, `❌ KYC отклонён — #<code>${updated.clientId}</code>`, employeeActionsKeyboard(phone, fromId));
  await notifyClientKycResult(updated, false, reason);
  return updated;
}

function extractFileId(msg) {
  if (msg.photo?.length) return msg.photo[msg.photo.length - 1].file_id;
  if (msg.document?.mime_type?.startsWith('image/')) return msg.document.file_id;
  return null;
}

async function sendTagPhoto(bot, chatId, emp, tagId) {
  const tag = getClientTag(emp, tagId);
  if (!tag?.photo) throw new Error('Фото не найдено');
  let caption = `${emp.clientId} · ${tag.label}\n${formatTagTime(tag.assignedAt)}`;
  if (tag.note) caption += `\n${tag.note}`;

  if (tag.photo.path) {
    const res = await bot.sendPhotoFile(chatId, attachmentAbsolutePath(tag.photo.path), caption);
    if (!res.ok) throw new Error(res.description || 'Ошибка отправки');
    return;
  }
  if (tag.photo.fileId) {
    const res = await bot.sendPhoto(chatId, tag.photo.fileId, { caption });
    if (!res.ok) throw new Error(res.description || 'Ошибка отправки');
  }
}

async function sendAllClientPhotos(bot, chatId, emp) {
  const tagged = (emp.tags || []).filter(t => t.photo?.path || t.photo?.fileId);
  if (!tagged.length) {
    await bot.sendMessage(chatId, 'Нет прикреплённых фото.');
    return;
  }
  await bot.sendMessage(chatId, `📷 Фото <code>${emp.clientId}</code> (${tagged.length}):`);
  for (const t of tagged) await sendTagPhoto(bot, chatId, emp, t.id);
}

async function sendExport(bot, chatId) {
  const res = await bot.sendDocument(chatId, buildExcelBuffer(), getExportFilename());
  if (!res.ok) await bot.sendMessage(chatId, `❌ ${res.description || 'Ошибка экспорта'}`);
  else await bot.sendMessage(chatId, `✅ Отчёт отправлен.${isSheetsConfigured() ? ' Sheets обновлён.' : ''}`);
}

async function executeBroadcast(bot, bc, creatorTelegramId) {
  const ids = resolveBroadcastRecipients(bc, creatorTelegramId);
  let sent = 0;
  let failed = 0;
  for (const tid of ids) {
    const res = await bot.sendMessage(tid, bc.text);
    if (res.ok) sent += 1;
    else failed += 1;
  }
  markBroadcastSent(bc.id);
  return { sent, failed, total: ids.length };
}

async function notifyBroadcastApprovers(bot, bc) {
  const notified = new Set();
  for (const op of listOperators()) {
    if (op.telegramId && !notified.has(op.telegramId)) {
      notified.add(op.telegramId);
      await bot.sendMessage(op.telegramId, formatBroadcastApproval(bc), {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `bc_ok:${bc.id}` },
          ]],
        },
      });
    }
  }
  for (const aid of listAdmins()) {
    if (!notified.has(aid)) {
      notified.add(aid);
      await bot.sendMessage(aid, formatBroadcastApproval(bc), {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить (админ)', callback_data: `bc_ok:${bc.id}` },
          ]],
        },
      });
    }
  }
}

async function finishTagAdd(bot, chatId, fromId, p, extras) {
  const actor = buildActor(fromId, '');
  const updated = addClientTag(p.phone, p.tagId, actor, extras);
  clearAllPending(chatId);
  await bot.sendMessage(chatId, [
    `✅ Тег <b>${p.tagLabel}</b>`,
    `Клиент: <code>${updated.clientId}</code>`,
  ].join('\n'), employeeActionsKeyboard(updated.phone, fromId));
}

async function finishFreeformTag(bot, chatId, fromId, phone, label, extras = {}) {
  const actor = buildActor(fromId, '');
  const updated = addClientTagFreeform(phone, label, actor, extras);
  pending.tagFreeform.delete(chatId);
  await bot.sendMessage(chatId, [
    `✅ Тег <b>${label}</b>`,
    `Клиент: <code>${updated.clientId}</code>`,
  ].join('\n'), employeeActionsKeyboard(updated.phone, fromId));
}

async function sendTagPicker(bot, chatId, phone, emp, fromId) {
  pending.tagFreeform.set(chatId, { phone });
  await bot.sendMessage(chatId, [
    `Теги — #<code>${emp.clientId}</code>`,
    '',
    'Выберите тег из списка или <b>отправьте свой текстом</b>.',
    'Можно прикрепить фото с подписью.',
    '/cancel — отмена',
  ].join('\n'), tagPickerKeyboard(phone, emp, fromId));
}

// ─── Message handlers ────────────────────────────────────────────────────────

async function handleMediaMessage(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const fileId = extractFileId(msg);
  if (!fileId || !hasStaffAccess(fromId) || !isPanelUnlocked(chatId, fromId)) return;

  const pFree = pending.tagFreeform.get(chatId);
  if (pFree) {
    try {
      const emp = requireClientAccess(fromId, pFree.phone);
      const photo = await saveTelegramFile(bot, fileId, emp.clientId, `tag_${Date.now()}`);
      const caption = (msg.caption || '').trim();
      const label = caption || 'Фото';
      await finishFreeformTag(bot, chatId, fromId, pFree.phone, label, { photo });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  const p = pending.tagAdd.get(chatId);
  if (!p) return;

  try {
    const emp = requireClientAccess(fromId, p.phone);
    const photo = await saveTelegramFile(bot, fileId, emp.clientId, p.tagId);
    const note = (msg.caption || '').trim();
    await finishTagAdd(bot, chatId, fromId, p, { photo, note: note || undefined });
  } catch (e) {
    await bot.sendMessage(chatId, `❌ ${e.message}`);
  }
}

async function handlePendingText(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const text = (msg.text || '').trim();
  const actor = getActor(fromId, msg.from.first_name);
  if (!hasStaffAccess(fromId) || !isPanelUnlocked(chatId, fromId)) return false;

  if (pending.kycReject.has(chatId)) {
    const { phone } = pending.kycReject.get(chatId);
    if (text.length < 3 || text.length > 300) {
      await bot.sendMessage(chatId, 'Причина должна содержать от 3 до 300 символов.');
      return true;
    }
    try {
      await rejectKyc(bot, chatId, fromId, msg.from.first_name, phone, text);
    } catch (e) {
      pending.kycReject.delete(chatId);
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.tagAdd.has(chatId)) {
    const p = pending.tagAdd.get(chatId);
    try {
      requireClientAccess(fromId, p.phone);
      await finishTagAdd(bot, chatId, fromId, p, { note: text });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.tagFreeform.has(chatId)) {
    const p = pending.tagFreeform.get(chatId);
    try {
      requireClientAccess(fromId, p.phone);
      await finishFreeformTag(bot, chatId, fromId, p.phone, text);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.editField.has(chatId)) {
    const p = pending.editField.get(chatId);
    pending.editField.delete(chatId);
    try {
      requireClientAccess(fromId, p.phone);
      const emp = setEmployeeField(p.phone, p.field, text);
      await bot.sendMessage(chatId, `✅ ${p.label} обновлено\n\n${formatEmployee(emp)}`, {
        ...employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.changeOperator.has(chatId)) {
    const p = pending.changeOperator.get(chatId);
    pending.changeOperator.delete(chatId);
    const name = rememberDeskOperatorName(fromId, text);
    try {
      requireClientAccess(fromId, p.phone);
      const emp = setEmployeeOperator(p.phone, name);
      await bot.sendMessage(chatId, `✅ Оператор: <b>${name}</b>\n\n${formatEmployee(emp)}`, {
        ...employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.deskOperatorName.has(chatId)) {
    const p = pending.deskOperatorName.get(chatId);
    pending.deskOperatorName.delete(chatId);
    const name = rememberDeskOperatorName(fromId, text);
    try {
      if (p.mode === 'add' && p.phone) {
        await finishAddClient(bot, chatId, fromId, p.phone, name, msg.from.first_name);
      } else {
        await bot.sendMessage(chatId, `✅ Вы работаете как <b>${name}</b>`, operatorKeyboard());
      }
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.addClient.has(chatId)) {
    const p = pending.addClient.get(chatId);
    if (p.step === 'phone' || p === true) {
      try {
        const phone = normalizePhoneForOperator(text);
        if (!phone) throw new Error('Неверный телефон. Номер должен содержать код +998. Пример: +998901234567');
        pending.addClient.set(chatId, { step: 'operator', phone });
        await bot.sendMessage(chatId, [
          `Телефон: <code>${phone}</code>`,
          '',
          '<b>Кто ведёт клиента?</b>',
          'Выберите имя или введите новое.',
        ].join('\n'), operatorNamePickerKeyboard(fromId, 'add'));
      } catch (e) {
        pending.addClient.delete(chatId);
        await bot.sendMessage(chatId, `❌ ${e.message}`);
      }
      return true;
    }
  }

  if (pending.findClient.has(chatId)) {
    pending.findClient.delete(chatId);
    try {
      const emp = resolveClientQuery(text, fromId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        ...employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.clientList.has(chatId)) {
    try {
      const emp = resolveClientQueryForList(text, fromId);
      pending.clientList.delete(chatId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        ...employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.addTagLabel.has(chatId)) {
    pending.addTagLabel.delete(chatId);
    try {
      const t = addTag(text, null, actor);
      const scope = actor?.isAdmin ? 'для всех' : 'только для вас';
      await bot.sendMessage(chatId, `✅ Тег <b>${t.label}</b> (${scope})`, tagsCatalogKeyboard(fromId));
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.broadcast.has(chatId)) {
    const p = pending.broadcast.get(chatId);
    if (p.step === 'id') {
      try {
        const emp = resolveClientQuery(text, fromId);
        p.phone = emp.phone;
        p.step = 'text';
        pending.broadcast.set(chatId, p);
        await bot.sendMessage(chatId, `Клиент #<code>${emp.clientId}</code> — введите сообщение:\n/cancel — отмена`);
      } catch (e) {
        pending.broadcast.delete(chatId);
        await bot.sendMessage(chatId, `❌ ${e.message}`);
      }
      return true;
    }
    pending.broadcast.delete(chatId);
    try {
      if (p.scope === 'one') {
        const tid = getTelegramIdByPhone(p.phone);
        if (!tid) throw new Error('Клиент не открывал бота — отправить нельзя');
        const res = await bot.sendMessage(tid, text);
        if (!res.ok) throw new Error('Не удалось отправить');
        await bot.sendMessage(chatId, '✅ Сообщение отправлено клиенту.');
      } else if (p.scope === 'mine') {
        const ids = listTelegramIdsForPhones(listEmployeesForUser(fromId, deskName(fromId)).map(e => e.phone));
        let sent = 0;
        for (const tid of ids) {
          const res = await bot.sendMessage(tid, text);
          if (res.ok) sent += 1;
        }
        await bot.sendMessage(chatId, `✅ Отправлено: ${sent} из ${ids.length} (у кого есть Telegram).`);
      } else if (p.scope === 'all') {
        const bc = createBroadcastRequest(text, fromId, 'all');
        await notifyBroadcastApprovers(bot, bc);
        await bot.sendMessage(chatId, `📨 Рассылка всем создана (<code>${bc.id}</code>).\nЖдёт подтверждения всех операторов или одного админа.`);
      }
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.addStaff.has(chatId) && isAdmin(fromId)) {
    const p = pending.addStaff.get(chatId);
    if (p.step === 'id' && p.type === 'operator') {
      pending.addStaff.delete(chatId);
      try {
        const op = addOperatorByTelegramId(text);
        await bot.sendMessage(chatId, [
          `✅ Доступ выдан: <code>${op.telegramId}</code>`,
          'Имя на смене оператор выберет сам: <b>👤 Кто я / сменить</b>',
        ].join('\n'), staffOpsKeyboard());
      } catch (e) {
        await bot.sendMessage(chatId, `❌ ${e.message}`);
      }
      return true;
    }
    if (p.step === 'id' && p.type === 'admin') {
      pending.addStaff.delete(chatId);
      try {
        await bot.sendMessage(chatId, `✅ Админ: <code>${addAdmin(text)}</code>`, staffAdminsKeyboard());
      } catch (e) {
        await bot.sendMessage(chatId, `❌ ${e.message}`);
      }
      return true;
    }
  }

  return false;
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;

  if (matchCmd(text, '/cancel')) {
    clearAllPending(chatId);
    if (hasStaffAccess(fromId) && isPanelUnlocked(chatId, fromId)) {
      await bot.sendMessage(chatId, 'Отменено.', panelKeyboard(fromId));
    } else {
      await bot.sendMessage(chatId, 'Отменено.');
    }
    return;
  }

  if (matchCmd(text, '/skip') && isPanelUnlocked(chatId, fromId) && pending.tagAdd.has(chatId)) {
    const p = pending.tagAdd.get(chatId);
    try {
      requireClientAccess(fromId, p.phone);
      await finishTagAdd(bot, chatId, fromId, p, {});
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }


  if (!text.startsWith('/') && await handlePendingText(bot, msg)) return;

  if (matchCmd(text, '/start')) {
    clearAllPending(chatId);
    lockPanel(chatId, fromId);
    await bot.sendMessage(chatId, '<b>Uztronix CRM</b>\n\nЛичный кабинет — Mini App.', { reply_markup: miniAppReplyKeyboard() });
    await bot.sendMessage(chatId, 'Mini App:', miniAppInlineKeyboard());
    return;
  }

  if (!text.startsWith('/') && hasStaffAccess(fromId) && matchesPanelSecret(text)) {
    unlockPanel(chatId, fromId);
    await openStaffPanel(bot, chatId, fromId);
    return;
  }

  if (matchCmd(text, '/admin', '/panel', '/operator') && hasStaffAccess(fromId)) {
    if (isPanelUnlocked(chatId, fromId)) {
      await openStaffPanel(bot, chatId, fromId);
    } else {
      await bot.sendMessage(chatId, 'Введите секретный номер для открытия служебного меню.');
    }
    return;
  }

  if (!text.startsWith('/')) return;

  const cmd = text.split(/\s+/)[0].toLowerCase();

  if (cmd === '/help' && hasStaffAccess(fromId) && isPanelUnlocked(chatId, fromId)) {
    await bot.sendMessage(chatId, isAdmin(fromId) ? adminHelpText() : operatorHelpText(), panelKeyboard(fromId));
    return;
  }

  if (cmd === '/export' && canExport(fromId) && isPanelUnlocked(chatId, fromId)) {
    await sendExport(bot, chatId);
  }
}

// ─── Callback handler ────────────────────────────────────────────────────────

async function handleCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const fromId = query.from?.id;
  const data = query.data || '';
  if (!hasStaffAccess(fromId)) {
    await bot.answerCallbackQuery(query.id, 'Нет доступа');
    return;
  }
  if (!isPanelUnlocked(chatId, fromId)) {
    await bot.answerCallbackQuery(query.id, 'Сначала введите секретный номер в чат');
    return;
  }
  const actor = getActor(fromId, query.from?.first_name);

  const panelActions = new Set([
    'noop_panel', 'adm_panel', 'op_panel', 'adm_clients', 'op_clients', 'adm_add', 'op_add',
    'adm_find', 'op_find', 'adm_tag_menu', 'op_tag_menu', 'sum_today', 'sum_ops', 'bc_menu',
    'staff_ops', 'staff_admins', 'admin_tags', 'admin_help', 'op_help', 'admin_operators',
    'admin_admins', 'admin_export', 'admin_list', 'staff_add_op', 'staff_add_admin',
    'bc_by_id', 'bc_mine', 'bc_all', 'tag_cancel', 'tag_add_new',
    'find_pick', 'find_type', 'bc_pick', 'bc_type',
  ]);
  const keepPending = data.startsWith('desk_add:') || data.startsWith('desk_set:')
    || data.startsWith('op_set:') || data === 'tag_skip';
  if (!keepPending && (panelActions.has(data) || data === 'noop')) clearAllPending(chatId);

  if (data === 'desk_switch') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '<b>Кто работает сейчас?</b>', operatorNamePickerKeyboard(fromId, 'set'));
    return;
  }

  if (data.startsWith('desk_set:')) {
    const key = data.slice(9);
    if (key === 'custom') {
      pending.deskOperatorName.set(chatId, { mode: 'set' });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, 'Введите имя оператора:\n/cancel — отмена');
      return;
    }
    const names = listRecentDeskNames(fromId);
    const name = names[Number(key)];
    if (!name) {
      await bot.answerCallbackQuery(query.id, 'Не найдено');
      return;
    }
    rememberDeskOperatorName(fromId, name);
    await bot.answerCallbackQuery(query.id, name);
    await bot.sendMessage(chatId, operatorPanelTitle(fromId), operatorKeyboard());
    return;
  }

  if (data.startsWith('desk_add:')) {
    const key = data.slice(9);
    const p = pending.addClient.get(chatId);
    if (!p?.phone) {
      await bot.answerCallbackQuery(query.id, 'Сначала введите телефон');
      return;
    }
    if (key === 'custom') {
      pending.deskOperatorName.set(chatId, { mode: 'add', phone: p.phone });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, 'Введите имя оператора:\n/cancel — отмена');
      return;
    }
    const names = listRecentDeskNames(fromId);
    const name = names[Number(key)];
    if (!name) {
      await bot.answerCallbackQuery(query.id, 'Не найдено');
      return;
    }
    try {
      await bot.answerCallbackQuery(query.id, name);
      await finishAddClient(bot, chatId, fromId, p.phone, name, query.from?.first_name || '');
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data === 'noop') {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === 'noop_panel') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, isAdmin(fromId) ? '<b>Панель администратора</b>' : operatorPanelTitle(fromId), panelKeyboard(fromId));
    return;
  }

  if (data === 'adm_panel' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Панель администратора</b>', adminKeyboard());
    return;
  }

  if (data === 'op_panel' && hasStaffAccess(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, operatorPanelTitle(fromId), operatorKeyboard());
    return;
  }

  if (data === 'sum_today') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, todayClientsSummary(), panelKeyboard(fromId));
    return;
  }

  if (data === 'sum_ops' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, operatorStatsSummary(), adminKeyboard());
    return;
  }

  if (data === 'bc_menu' && hasStaffAccess(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '<b>Рассылка</b>\nСообщение уйдёт от имени бота клиентам с Telegram.', broadcastMenuKeyboard(fromId));
    return;
  }

  if (data === 'bc_by_id') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '<b>Сообщение клиенту</b>', pickOrTypeKeyboard('bc'));
    return;
  }

  if (data === 'bc_mine') {
    pending.broadcast.set(chatId, { scope: 'mine' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Введите текст для всех ваших клиентов:\n/cancel — отмена');
    return;
  }

  if (data === 'bc_all' && hasStaffAccess(fromId)) {
    pending.broadcast.set(chatId, { scope: 'all' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Введите текст для <b>всех</b> клиентов.\nНужно подтверждение всех операторов или одного админа.\n/cancel — отмена');
    return;
  }

  if (data.startsWith('bc_cl:')) {
    const phone = `+${data.slice(6)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      pending.broadcast.set(chatId, { scope: 'one', phone, step: 'text' });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Сообщение для #<code>${emp.clientId}</code>:\n/cancel — отмена`);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('bc_ok:')) {
    const id = data.slice(6);
    const bc = approveBroadcast(id, fromId);
    if (!bc) {
      await bot.answerCallbackQuery(query.id, 'Не найдено');
      return;
    }
    await bot.answerCallbackQuery(query.id, bc.status === 'ready' ? 'Одобрено' : 'Записано');
    if (bc.status === 'ready') {
      const { sent, failed, total } = await executeBroadcast(bot, bc, bc.createdBy);
      await bot.sendMessage(chatId, `✅ Рассылка <code>${id}</code> отправлена: ${sent}/${total}${failed ? ` (ошибок: ${failed})` : ''}.`);
    } else {
      await bot.sendMessage(chatId, formatBroadcastApproval(bc));
    }
    return;
  }

  if (data === 'staff_ops' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Операторы</b>', staffOpsKeyboard());
    return;
  }

  if (data === 'staff_admins' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Админы</b>', staffAdminsKeyboard());
    return;
  }

  if (data === 'staff_add_op' && isAdmin(fromId)) {
    pending.addStaff.set(chatId, { type: 'operator', step: 'id' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, [
      'Telegram ID аккаунта оператора (число):',
      'Имя на смене он задаст сам в панели.',
      '/cancel — отмена',
    ].join('\n'));
    return;
  }

  if (data === 'staff_add_admin' && isAdmin(fromId)) {
    pending.addStaff.set(chatId, { type: 'admin', step: 'id' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Telegram ID нового админа:\n/cancel — отмена');
    return;
  }

  if (data === 'admin_export' && canExport(fromId)) {
    await bot.answerCallbackQuery(query.id, 'Готовлю...');
    await sendExport(bot, chatId);
    return;
  }

  if (data === 'adm_clients' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    const employees = listEmployeesForUser(fromId);
    const incompleteCount = employees.filter(e => !isClientProfileComplete(e)).length;
    await bot.editMessageText(
      chatId,
      messageId,
      clientListHeader(fromId, employees.length, { incompleteCount }),
      clientListKeyboard(employees, 'view_cl', 0),
    );
    return;
  }

  if (data === 'op_clients') {
    await bot.answerCallbackQuery(query.id);
    if (!ensureDeskOperatorForList(fromId)) {
      await bot.sendMessage(chatId, [
        '<b>Сначала укажите имя оператора</b>',
        'На общем аккаунте каждый работает под своим именем.',
      ].join('\n'), operatorNamePickerKeyboard(fromId, 'set'));
      return;
    }
    const employees = listEmployeesForUser(fromId, deskName(fromId));
    const incompleteCount = employees.filter(e => !isClientProfileComplete(e)).length;
    pending.clientList.set(chatId, true);
    await bot.editMessageText(
      chatId,
      messageId,
      clientListHeader(fromId, employees.length, { allowIdInput: true, incompleteCount }),
      clientListKeyboard(employees, 'view_cl', 0),
    );
    return;
  }

  if (data.startsWith('cl_list:')) {
    const [, prefix, pageStr] = data.split(':');
    const page = Number(pageStr) || 0;
    const employees = listEmployeesForUser(fromId, deskName(fromId));
    const allowIdInput = pending.clientList.has(chatId);
    const incompleteCount = employees.filter(e => !isClientProfileComplete(e)).length;
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(
      chatId,
      messageId,
      clientListHeader(fromId, employees.length, { allowIdInput, incompleteCount }),
      clientListKeyboard(employees, prefix, page),
    );
    return;
  }

  if (data === 'admin_tags') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, formatTagsCatalog(fromId), tagsCatalogKeyboard(fromId));
    return;
  }

  if (data === 'tag_add_new' && hasStaffAccess(fromId)) {
    pending.addTagLabel.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    const hint = isAdmin(fromId) ? 'Тег будет доступен всем операторам.' : 'Тег будет только у вас.';
    await bot.sendMessage(chatId, `Название нового тега:\n${hint}\n/cancel — отмена`);
    return;
  }

  if (data === 'admin_operators' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatOperatorsList(), staffOpsKeyboard());
    return;
  }

  if (data === 'admin_admins' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatAdminsList(), staffAdminsKeyboard());
    return;
  }

  if (data === 'admin_help' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, adminHelpText(), adminKeyboard());
    return;
  }

  if (data === 'op_help') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, operatorHelpText(), operatorKeyboard());
    return;
  }

  if (data === 'adm_add' && isAdmin(fromId)) {
    pending.addClient.set(chatId, { step: 'phone' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Телефон клиента:\n<code>+998901234567</code>\n/cancel — отмена');
    return;
  }

  if (data === 'op_add') {
    pending.addClient.set(chatId, { step: 'phone' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Телефон клиента:\n<code>+998901234567</code>\n/cancel — отмена');
    return;
  }

  if (data === 'adm_find' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '<b>Поиск клиента</b>', pickOrTypeKeyboard('find'));
    return;
  }

  if (data === 'op_find') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, '<b>Поиск клиента</b>', pickOrTypeKeyboard('find'));
    return;
  }

  if (data === 'find_pick' || data === 'bc_pick') {
    const prefix = data === 'bc_pick' ? 'bc_cl' : 'view_cl';
    const employees = listEmployeesForUser(fromId, deskName(fromId));
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      chatId,
      clientListHeader(fromId, employees.length),
      clientListKeyboard(employees, prefix, 0),
    );
    return;
  }

  if (data === 'find_type') {
    pending.findClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Поиск: ID <code>1</code> или телефон <code>+998...</code>\n/cancel — отмена');
    return;
  }

  if (data === 'bc_type') {
    pending.broadcast.set(chatId, { scope: 'one', step: 'id' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Введите <b>ID клиента</b> (например <code>1</code>):\n/cancel — отмена');
    return;
  }

  if (data === 'adm_tag_menu' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Клиент для тега:', {
      ...clientPickerKeyboard(listEmployeesForUser(fromId), 'tag_cl'),
    });
    return;
  }

  if (data === 'op_tag_menu') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Клиент для тега:', {
      ...clientPickerKeyboard(listEmployeesForUser(fromId), 'tag_cl'),
    });
    return;
  }

  if (data.startsWith('tag_cl:')) {
    const phone = `+${data.slice(7)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await sendTagPicker(bot, chatId, phone, emp, fromId);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('view_cl:') || data.startsWith('pick_tg:')) {
    const phone = `+${data.slice(data.indexOf(':') + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      pending.clientList.delete(chatId);
      pending.tagFreeform.delete(chatId);
      await bot.answerCallbackQuery(query.id);
      if (data.startsWith('pick_tg')) {
        await sendTagPicker(bot, chatId, phone, emp, fromId);
      } else {
        await bot.sendMessage(chatId, formatEmployee(emp), employeeActionsKeyboard(phone, fromId));
      }
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('edit_cl:')) {
    const phone = `+${data.slice(8)}`;
    try {
      requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, 'Что изменить?', clientEditKeyboard(phone));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('edit_f:')) {
    const [, key, digits] = data.split(':');
    const phone = `+${digits}`;
    try {
      requireClientAccess(fromId, phone);
      const def = CLIENT_EDIT_FIELDS.find(f => f.key === key);
      pending.editField.set(chatId, { phone, field: def.field, label: def.label });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Введите: <b>${def.label}</b>\n/cancel — отмена`);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('op_chg:')) {
    const phone = `+${data.slice(7)}`;
    try {
      requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, '<b>Кто ведёт клиента?</b>', clientOperatorPickerKeyboard(phone, fromId));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('op_set:')) {
    const parts = data.split(':');
    const key = parts[1];
    const digits = parts[2];
    const phone = `+${digits}`;
    try {
      requireClientAccess(fromId, phone);
      if (key === 'custom') {
        pending.changeOperator.set(chatId, { phone });
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Введите имя оператора:\n/cancel — отмена');
        return;
      }
      const name = listRecentDeskNames(fromId)[Number(key)];
      if (!name) throw new Error('Не найдено');
      rememberDeskOperatorName(fromId, name);
      const updated = setEmployeeOperator(phone, name);
      await bot.answerCallbackQuery(query.id, name);
      await bot.sendMessage(chatId, `✅ Оператор: <b>${name}</b>\n\n${formatEmployee(updated)}`, {
        ...employeeActionsKeyboard(phone, fromId),
      });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data === 'tag_cancel') {
    clearAllPending(chatId);
    await bot.answerCallbackQuery(query.id, 'Отменено');
    await bot.sendMessage(chatId, 'Добавление тега отменено.', panelKeyboard(fromId));
    return;
  }

  if (data === 'tag_skip') {
    const p = pending.tagAdd.get(chatId);
    if (!p) {
      await bot.answerCallbackQuery(query.id, 'Сессия истекла');
      return;
    }
    try {
      requireClientAccess(fromId, p.phone);
      await bot.answerCallbackQuery(query.id, '✓');
      await finishTagAdd(bot, chatId, fromId, p, {});
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_sel:')) {
    const rest = data.slice(8);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      const tag = listTagsForUser(fromId).find(t => t.id === tagId);
      if (!tag) throw new Error('Тег не найден');
      pending.tagFreeform.delete(chatId);
      pending.tagAdd.set(chatId, { phone, tagId, tagLabel: tag.label });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, [
        `Тег <b>${tag.label}</b> — клиент #<code>${emp.clientId}</code>`,
        '',
        'Отправьте текст, фото или оба.',
        'Или нажмите кнопку ниже.',
      ].join('\n'), tagAddPromptKeyboard());
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_open:')) {
    const rest = data.slice(9);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      const tag = getClientTag(emp, tagId);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, [
        `<b>${tag?.label || tagId}</b>`,
        tag?.note ? `📝 ${tag.note}` : '',
        tag?.photo ? '📎 Есть фото' : '',
      ].filter(Boolean).join('\n'), tagOpenKeyboard(phone, emp, tagId, fromId));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_note:')) {
    const rest = data.slice(9);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      const tag = getClientTag(emp, tagId);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, tag?.note || '—');
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_rm:')) {
    const rest = data.slice(7);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      requireClientAccess(fromId, phone);
      const updated = removeClientTag(phone, tagId, actor);
      await bot.answerCallbackQuery(query.id, 'Снят');
      await bot.sendMessage(chatId, formatEmployee(updated), employeeActionsKeyboard(phone, fromId));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_view:')) {
    const rest = data.slice(9);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await sendTagPhoto(bot, chatId, emp, tagId);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('tag_photos:')) {
    const phone = `+${data.slice(11)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Фото — #<code>${emp.clientId}</code>:`, tagPhotosKeyboard(phone, emp));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('client_photos:') && isAdmin(fromId)) {
    const phone = `+${data.slice(14)}`;
    try {
      const emp = getEmployee(phone);
      await bot.answerCallbackQuery(query.id);
      await sendAllClientPhotos(bot, chatId, emp);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('kyc_view:')) {
    const phone = `+${data.slice(9)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await sendKycDocumentsToChat(bot, chatId, emp);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('kyc_ok:')) {
    const phone = `+${data.slice(7)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      if (emp.kycStatus !== 'pending') throw new Error('KYC уже обработан');
      const reviewer = buildActor(fromId, query.from?.first_name || '');
      const updated = setKycStatus(phone, 'approved', reviewer);
      await bot.answerCallbackQuery(query.id, 'Принято');
      await bot.editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
      await bot.sendMessage(chatId, `✅ KYC подтверждён — #<code>${updated.clientId}</code>`, employeeActionsKeyboard(phone, fromId));
      await notifyClientKycResult(updated, true);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('kyc_rej:')) {
    const phone = `+${data.slice(8)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      if (emp.kycStatus !== 'pending') throw new Error('KYC уже обработан');
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
      await bot.sendMessage(chatId, `Почему отклонён KYC клиента #<code>${emp.clientId}</code>?`, kycRejectionKeyboard(phone));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('kyc_reason:')) {
    const [reasonCode, digits] = data.slice(11).split(':');
    const phone = `+${digits || ''}`;
    try {
      requireClientAccess(fromId, phone);
      await bot.editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
      if (reasonCode === 'other') {
        pending.kycReject.set(chatId, { phone });
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(chatId, 'Введите причину отказа (3–300 символов):\n/cancel — отмена');
        return;
      }
      const reason = KYC_REJECTION_REASONS[reasonCode];
      if (!reason) throw new Error('Причина не найдена');
      await rejectKyc(bot, chatId, fromId, query.from?.first_name, phone, reason);
      await bot.answerCallbackQuery(query.id, 'Отклонено');
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  await bot.answerCallbackQuery(query.id);
}

export function startBot(token) {
  const bot = createBotApi(token);
  setKycBot(bot);
  let offset = 0;
  const url = process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app';
  if (!isPanelSecretConfigured()) {
    console.error('STAFF_PANEL_SECRET must contain 4–32 digits; staff menu is locked.');
  }

  bot.setChatMenuButton({ type: 'web_app', text: 'Shaxsiy kabinet', web_app: { url } }).catch(() => {});

  async function poll() {
    while (true) {
      try {
        const res = await bot.getUpdates(offset);
        if (res.ok && res.result?.length) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            if (update.message) {
              if (update.message.photo || update.message.document) await handleMediaMessage(bot, update.message);
              else await handleCommand(bot, update.message);
            }
            if (update.callback_query) await handleCallback(bot, update.callback_query);
          }
        }
      } catch (e) {
        console.error('Bot poll error:', e.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  poll();
  console.log('Uztronix CRM bot started');
}
