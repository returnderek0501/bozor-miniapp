import {
  addPhone,
  getEmployee, setEmployeeField, listEmployeesForUser, findEmployeeByClientId,
  maskCard,
  normalizePhone, getClientTag,
  addClientTag, removeClientTag,
  listTelegramIdsForPhones, getTelegramIdByPhone,
} from './store.js';
import { isAdmin, listAdmins, addAdmin, isEnvAdmin } from './admins.js';
import { listOperators, addOperator } from './operators.js';
import { listTags, formatTagTime } from './tags.js';
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
import { CLIENT_EDIT_FIELDS } from './clientFields.js';

// ─── Keyboards ───────────────────────────────────────────────────────────────

function panelKeyboard(telegramId) {
  return isAdmin(telegramId) ? adminKeyboard() : operatorKeyboard();
}

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Клиенты', callback_data: 'adm_clients' }, { text: '➕ Клиент', callback_data: 'adm_add' }],
        [{ text: '🔍 Поиск', callback_data: 'adm_find' }, { text: '🏷 Теги', callback_data: 'adm_tag_menu' }],
        [{ text: '📅 Сегодня', callback_data: 'sum_today' }, { text: '📊 Сводка оп.', callback_data: 'sum_ops' }],
        [{ text: '✉️ Рассылка', callback_data: 'bc_menu' }, { text: '📊 Экспорт', callback_data: 'admin_export' }],
        [{ text: '👔 Операторы', callback_data: 'staff_ops' }, { text: '🔑 Админы', callback_data: 'staff_admins' }],
        [{ text: '🏷 Справочник тегов', callback_data: 'admin_tags' }, { text: 'ℹ️ Помощь', callback_data: 'admin_help' }],
      ],
    },
  };
}

function operatorKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Мои клиенты', callback_data: 'op_clients' }, { text: '➕ Клиент', callback_data: 'op_add' }],
        [{ text: '🔍 Поиск', callback_data: 'op_find' }, { text: '🏷 Теги', callback_data: 'op_tag_menu' }],
        [{ text: '📅 Сегодня', callback_data: 'sum_today' }, { text: '✉️ Рассылка', callback_data: 'bc_menu' }],
        [{ text: '🏷 Справочник тегов', callback_data: 'admin_tags' }, { text: 'ℹ️ Помощь', callback_data: 'op_help' }],
      ],
    },
  };
}

function staffOpsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Добавить оператора', callback_data: 'staff_add_op' }],
        [{ text: '📋 Список', callback_data: 'admin_operators' }],
        [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
      ],
    },
  };
}

function staffAdminsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Добавить админа', callback_data: 'staff_add_admin' }],
        [{ text: '📋 Список', callback_data: 'admin_admins' }],
        [{ text: '◀️ Панель', callback_data: 'noop_panel' }],
      ],
    },
  };
}

function broadcastMenuKeyboard(telegramId) {
  const rows = [
    [{ text: '👤 Одному клиенту', callback_data: 'bc_one' }],
    [{ text: '👥 Всем моим', callback_data: 'bc_mine' }],
  ];
  rows.push([{ text: '🌐 Всем клиентам (с подтв.)', callback_data: 'bc_all' }]);
  rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return { inline_keyboard: rows };
}

function tagAddPromptKeyboard() {
  return {
    inline_keyboard: [[
      { text: '✓ Без вложений', callback_data: 'tag_skip' },
      { text: '✕ Отмена', callback_data: 'noop_panel' },
    ]],
  };
}

function employeeActionsKeyboard(phone, telegramId) {
  const digits = phoneDigits(phone);
  const rows = [
    [
      { text: '✏️ Данные', callback_data: `edit_cl:${digits}` },
      { text: '🏷 Теги', callback_data: `pick_tg:${digits}` },
    ],
    [{ text: '📎 Фото тегов', callback_data: `tag_photos:${digits}` }],
  ];
  if (isAdmin(telegramId)) {
    rows.push([{ text: '📷 Все фото', callback_data: `client_photos:${digits}` }]);
  }
  rows.push([{ text: '◀️ Панель', callback_data: isAdmin(telegramId) ? 'adm_panel' : 'op_panel' }]);
  return { inline_keyboard: rows };
}

function clientEditKeyboard(phone) {
  const digits = phoneDigits(phone);
  const rows = CLIENT_EDIT_FIELDS.map(f => ([{
    text: f.label,
    callback_data: `edit_f:${f.key}:${digits}`,
  }]));
  rows.push([{ text: '◀️ К клиенту', callback_data: `view_cl:${digits}` }]);
  return { inline_keyboard: rows };
}

function clientPickerKeyboard(employees, prefix) {
  const rows = employees.slice(0, 40).map(e => [{
    text: `${e.clientId || '—'} · ${e.fullName || e.phone}`,
    callback_data: `${prefix}:${phoneDigits(e.phone)}`,
  }]);
  if (!rows.length) rows.push([{ text: '— пусто —', callback_data: 'noop' }]);
  rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return { inline_keyboard: rows };
}

function tagPickerKeyboard(phone, emp) {
  const digits = phoneDigits(phone);
  const tags = listTags();
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
  return { inline_keyboard: rows };
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
  return { inline_keyboard: rows };
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
  return { inline_keyboard: rows };
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
  return { inline_keyboard: [[{ text: '📱 Shaxsiy kabinet', web_app: { url } }]] };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatMoney(n) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

function phoneDigits(phone) {
  return normalizePhone(phone)?.replace(/\D/g, '') || '';
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
  const cards = emp.allowedCards?.length
    ? emp.allowedCards.map(c => `  • <code>${maskCard(c)}</code>`).join('\n')
    : '  —';
  const operator = emp.operator || emp.createdByName || '—';

  return [
    `<b>Клиент: ${emp.fullName || '—'}</b>`,
    `ID: <code>${emp.clientId || '—'}</code>`,
    `Телефон: <code>${emp.phone}</code>`,
    `Оператор: <b>${operator}</b>`,
    `Теги:\n${formatTagsList(emp)}`,
    `Кабинет — должность: ${emp.position || '—'}`,
    `Отдел: ${emp.department || '—'}`,
    `Стаж: ${emp.tenure || '—'}`,
    `ID кабинета: ${emp.employeeId || '—'}`,
    `Аванс: ${formatMoney(emp.advanceBalance)} сум`,
    `Добавлен: ${emp.createdAt ? formatTagTime(emp.createdAt) : '—'}`,
    `Карты:\n${cards}`,
  ].join('\n');
}

function formatEmployeesList(telegramId) {
  const employees = listEmployeesForUser(telegramId);
  if (!employees.length) return 'Список пуст.';
  const title = isAdmin(telegramId) ? 'Все клиенты' : 'Мои клиенты';
  return [
    `<b>${title} (${employees.length})</b>`,
    '',
    ...employees.map(e => {
      const tags = e.tags?.map(t => t.label).join(', ') || '—';
      return `• <code>${e.clientId || '—'}</code> ${e.fullName || e.phone} | ${e.operator || '—'} | ${tags}`;
    }),
  ].join('\n');
}

function formatOperatorsList() {
  const ops = listOperators();
  if (!ops.length) return 'Операторы пусты.';
  return [
    `<b>Операторы (${ops.length})</b>`,
    '',
    ...ops.map(o =>
      `• <b>${o.name}</b>${o.telegramId ? ` — <code>${o.telegramId}</code>` : ' — Telegram не привязан'}`,
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

function formatTagsCatalog() {
  const tags = listTags();
  return [
    `<b>Теги — действия клиента (${tags.length})</b>`,
    '',
    ...tags.map(t => `• <code>${t.id}</code> — ${t.label}`),
    '',
    '<i>При добавлении тега можно отправить текст, фото или оба.</i>',
  ].join('\n');
}

function adminHelpText() {
  return 'Управление — кнопками в панели. /admin — панель администратора.';
}

function operatorHelpText() {
  return 'Управление — кнопками в панели. /panel — панель оператора.';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveClientQuery(query, telegramId) {
  const q = String(query || '').trim();
  let emp = /^CLT-/i.test(q) ? findEmployeeByClientId(q) : getEmployee(normalizePhone(q));
  if (!emp?.phone) throw new Error('Клиент не найден');
  if (!canViewClient(telegramId, emp)) throw new Error('Нет доступа');
  return emp;
}

function requireClientAccess(fromId, phone) {
  const emp = getEmployee(phone);
  if (!canManageClient(fromId, emp)) throw new Error('Нет доступа к клиенту');
  return emp;
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
  const actor = getActor(fromId, '');
  const updated = addClientTag(p.phone, p.tagId, actor, extras);
  clearAllPending(chatId);
  await bot.sendMessage(chatId, [
    `✅ Тег <b>${p.tagLabel}</b>`,
    `Клиент: <code>${updated.clientId}</code>`,
  ].join('\n'), { reply_markup: employeeActionsKeyboard(updated.phone, fromId) });
}

// ─── Message handlers ────────────────────────────────────────────────────────

async function handleMediaMessage(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const p = pending.tagAdd.get(chatId);
  if (!p || !hasStaffAccess(fromId)) return;

  const fileId = extractFileId(msg);
  if (!fileId) return;

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

  if (pending.editField.has(chatId)) {
    const p = pending.editField.get(chatId);
    pending.editField.delete(chatId);
    try {
      requireClientAccess(fromId, p.phone);
      const emp = setEmployeeField(p.phone, p.field, text);
      await bot.sendMessage(chatId, `✅ ${p.label} обновлено\n\n${formatEmployee(emp)}`, {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.addClient.has(chatId)) {
    pending.addClient.delete(chatId);
    try {
      const phone = addPhone(text, actor);
      const emp = getEmployee(phone);
      await bot.sendMessage(chatId, `✅ Клиент <code>${emp.clientId}</code>\nТел: <code>${phone}</code>`, {
        reply_markup: employeeActionsKeyboard(phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.findClient.has(chatId)) {
    pending.findClient.delete(chatId);
    try {
      const emp = resolveClientQuery(text, fromId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return true;
  }

  if (pending.broadcast.has(chatId)) {
    const p = pending.broadcast.get(chatId);
    pending.broadcast.delete(chatId);
    try {
      if (p.scope === 'one') {
        const tid = getTelegramIdByPhone(p.phone);
        if (!tid) throw new Error('Клиент не открывал бота — отправить нельзя');
        const res = await bot.sendMessage(tid, text);
        if (!res.ok) throw new Error('Не удалось отправить');
        await bot.sendMessage(chatId, '✅ Сообщение отправлено клиенту.');
      } else if (p.scope === 'mine') {
        const ids = listTelegramIdsForPhones(listEmployeesForUser(fromId).map(e => e.phone));
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
    if (p.step === 'name') {
      p.name = text;
      p.step = 'tg';
      pending.addStaff.set(chatId, p);
      await bot.sendMessage(chatId, 'Telegram ID оператора (число) или /skip');
      return true;
    }
    if (p.step === 'tg' && p.type === 'operator') {
      pending.addStaff.delete(chatId);
      try {
        const tid = /^\d+$/.test(text) ? text : null;
        const op = tid ? addOperator(p.name, tid) : addOperator(p.name);
        await bot.sendMessage(chatId, `✅ Оператор: <b>${op.name}</b>${op.telegramId ? ` (<code>${op.telegramId}</code>)` : ''}`, staffOpsKeyboard());
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

  if (text === '/cancel') {
    clearAllPending(chatId);
    await bot.sendMessage(chatId, 'Отменено.', panelKeyboard(fromId));
    return;
  }

  if (text === '/skip' && pending.addStaff.has(chatId)) {
    const p = pending.addStaff.get(chatId);
    if (p.type === 'operator' && p.step === 'tg' && p.name) {
      pending.addStaff.delete(chatId);
      try {
        const op = addOperator(p.name);
        await bot.sendMessage(chatId, `✅ Оператор: <b>${op.name}</b> (без Telegram ID)`, staffOpsKeyboard());
      } catch (e) {
        await bot.sendMessage(chatId, `❌ ${e.message}`);
      }
    }
    return;
  }

  if (!text.startsWith('/') && await handlePendingText(bot, msg)) return;

  if (text === '/start') {
    clearAllPending(chatId);
    await bot.sendMessage(chatId, '<b>Uztronix CRM</b>\n\nЛичный кабинет — Mini App.', { reply_markup: miniAppReplyKeyboard() });
    await bot.sendMessage(chatId, 'Mini App:', { reply_markup: miniAppInlineKeyboard() });
    if (isAdmin(fromId)) await bot.sendMessage(chatId, '<b>Панель администратора</b>', adminKeyboard());
    else if (hasStaffAccess(fromId)) await bot.sendMessage(chatId, '<b>Панель оператора</b>', operatorKeyboard());
    return;
  }

  if (text === '/admin' && isAdmin(fromId)) {
    clearAllPending(chatId);
    await bot.sendMessage(chatId, '<b>Панель администратора</b>', adminKeyboard());
    return;
  }

  if ((text === '/panel' || text === '/operator') && hasStaffAccess(fromId) && !isAdmin(fromId)) {
    clearAllPending(chatId);
    await bot.sendMessage(chatId, '<b>Панель оператора</b>', operatorKeyboard());
    return;
  }

  if (!text.startsWith('/')) return;

  const cmd = text.split(/\s+/)[0].toLowerCase();

  if (cmd === '/help' && hasStaffAccess(fromId)) {
    await bot.sendMessage(chatId, isAdmin(fromId) ? adminHelpText() : operatorHelpText(), panelKeyboard(fromId));
    return;
  }

  if (cmd === '/export' && canExport(fromId)) {
    await sendExport(bot, chatId);
  }
}

// ─── Callback handler ────────────────────────────────────────────────────────

async function handleCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const fromId = query.from?.id;
  const data = query.data || '';
  const actor = getActor(fromId, query.from?.first_name);

  const panelActions = new Set([
    'noop_panel', 'adm_panel', 'op_panel', 'adm_clients', 'op_clients', 'adm_add', 'op_add',
    'adm_find', 'op_find', 'adm_tag_menu', 'op_tag_menu', 'sum_today', 'sum_ops', 'bc_menu',
    'staff_ops', 'staff_admins', 'admin_tags', 'admin_help', 'op_help', 'admin_operators',
    'admin_admins', 'admin_export', 'admin_list', 'staff_add_op', 'staff_add_admin',
    'bc_one', 'bc_mine', 'bc_all',
  ]);
  if (panelActions.has(data) || data === 'noop') clearAllPending(chatId);

  if (data === 'noop') {
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === 'noop_panel') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, isAdmin(fromId) ? '<b>Панель администратора</b>' : '<b>Панель оператора</b>', panelKeyboard(fromId));
    return;
  }

  if (data === 'adm_panel' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Панель администратора</b>', adminKeyboard());
    return;
  }

  if (data === 'op_panel' && hasStaffAccess(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Панель оператора</b>', operatorKeyboard());
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

  if (data === 'bc_one') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Выберите клиента:', {
      reply_markup: clientPickerKeyboard(listEmployeesForUser(fromId), 'bc_cl'),
    });
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
      requireClientAccess(fromId, phone);
      pending.broadcast.set(chatId, { scope: 'one', phone });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Сообщение для <code>${phone}</code>:\n/cancel — отмена`);
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
    pending.addStaff.set(chatId, { type: 'operator', step: 'name' });
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Имя оператора:\n/cancel — отмена');
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

  if (!hasStaffAccess(fromId)) {
    await bot.answerCallbackQuery(query.id, 'Нет доступа');
    return;
  }

  if (data === 'adm_clients' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatEmployeesList(fromId), adminKeyboard());
    return;
  }

  if (data === 'op_clients') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatEmployeesList(fromId), operatorKeyboard());
    return;
  }

  if (data === 'admin_tags') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatTagsCatalog(), panelKeyboard(fromId));
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
    pending.addClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Телефон клиента:\n<code>+998901234567</code>\n/cancel — отмена');
    return;
  }

  if (data === 'op_add') {
    pending.addClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Телефон клиента:\n<code>+998901234567</code>\n/cancel — отмена');
    return;
  }

  if (data === 'adm_find' && isAdmin(fromId)) {
    pending.findClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Поиск: <code>CLT-000001</code> или телефон\n/cancel — отмена');
    return;
  }

  if (data === 'op_find') {
    pending.findClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Поиск: <code>CLT-000001</code> или телефон\n/cancel — отмена');
    return;
  }

  if (data === 'adm_tag_menu' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Клиент для тега:', {
      reply_markup: clientPickerKeyboard(listEmployeesForUser(fromId), 'tag_cl'),
    });
    return;
  }

  if (data === 'op_tag_menu') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Клиент для тега:', {
      reply_markup: clientPickerKeyboard(listEmployeesForUser(fromId), 'tag_cl'),
    });
    return;
  }

  if (data.startsWith('tag_cl:')) {
    const phone = `+${data.slice(7)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Теги — <code>${emp.clientId}</code>:`, { reply_markup: tagPickerKeyboard(phone, emp) });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('view_cl:') || data.startsWith('pick_tg:')) {
    const phone = `+${data.slice(data.indexOf(':') + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      if (data.startsWith('pick_tg')) {
        await bot.sendMessage(chatId, `Теги — <code>${emp.clientId}</code>:`, { reply_markup: tagPickerKeyboard(phone, emp) });
      } else {
        await bot.sendMessage(chatId, formatEmployee(emp), { reply_markup: employeeActionsKeyboard(phone, fromId) });
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
      await bot.sendMessage(chatId, 'Что изменить?', { reply_markup: clientEditKeyboard(phone) });
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
      const tag = listTags().find(t => t.id === tagId);
      if (!tag) throw new Error('Тег не найден');
      pending.tagAdd.set(chatId, { phone, tagId, tagLabel: tag.label });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, [
        `Тег <b>${tag.label}</b> — клиент <code>${emp.clientId}</code>`,
        '',
        'Отправьте <b>текст</b>, <b>фото</b> или оба.',
        'Или нажмите «Без вложений».',
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
      ].filter(Boolean).join('\n'), { reply_markup: tagOpenKeyboard(phone, emp, tagId, fromId) });
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
      await bot.sendMessage(chatId, formatEmployee(updated), { reply_markup: employeeActionsKeyboard(phone, fromId) });
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
      await bot.sendMessage(chatId, `Фото — <code>${emp.clientId}</code>:`, { reply_markup: tagPhotosKeyboard(phone, emp) });
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

  await bot.answerCallbackQuery(query.id);
}

export function startBot(token) {
  const bot = createBotApi(token);
  let offset = 0;
  const url = process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app';

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
