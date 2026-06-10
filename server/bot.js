import {
  listPhones, addPhone, removePhone,
  getEmployee, setEmployeeField, listEmployeesForUser, findEmployeeByClientId,
  addEmployeeCard, removeEmployeeCard, maskCard,
  setEmployeeOperator, normalizePhone, getClientTag,
  addClientTag, removeClientTag,
} from './store.js';
import { isAdmin, listAdmins, addAdmin, removeAdmin, isEnvAdmin } from './admins.js';
import {
  listOperators, listOperatorNames, addOperator, removeOperator, linkOperator,
} from './operators.js';
import { listTags, addTag, removeTag, formatTagTime } from './tags.js';
import {
  getActor, hasStaffAccess, canExport, canManageClient, canViewClient, canManageTagDefinitions,
} from './permissions.js';
import { buildExcelBuffer, getExportFilename } from './export.js';
import { isSheetsConfigured } from './sheets.js';
import { createBotApi } from './telegram.js';
import { saveTelegramFile, attachmentAbsolutePath } from './attachments.js';

const pendingCustomOperator = new Map();
const pendingAddClient = new Map();
const pendingFindClient = new Map();
const pendingTagPhoto = new Map();

function panelKeyboard(telegramId) {
  return isAdmin(telegramId) ? adminKeyboard() : operatorKeyboard();
}

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👤 Все клиенты', callback_data: 'adm_clients' },
          { text: '➕ Новый лид', callback_data: 'adm_add' },
        ],
        [
          { text: '🔍 Поиск', callback_data: 'adm_find' },
          { text: '🏷 Тег + фото', callback_data: 'adm_tag_menu' },
        ],
        [
          { text: '📊 Экспорт', callback_data: 'admin_export' },
          { text: '📋 Телефоны', callback_data: 'admin_list' },
        ],
        [
          { text: '🏷 Справочник тегов', callback_data: 'admin_tags' },
          { text: '👔 Операторы', callback_data: 'admin_operators' },
        ],
        [
          { text: '🔑 Админы', callback_data: 'admin_admins' },
          { text: 'ℹ️ Помощь', callback_data: 'admin_help' },
        ],
      ],
    },
  };
}

function operatorKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '👤 Мои клиенты', callback_data: 'op_clients' },
          { text: '➕ Новый клиент', callback_data: 'op_add' },
        ],
        [
          { text: '🔍 Поиск', callback_data: 'op_find' },
          { text: '🏷 Тег + фото', callback_data: 'op_tag_menu' },
        ],
        [
          { text: '🏷 Справочник тегов', callback_data: 'admin_tags' },
          { text: 'ℹ️ Помощь', callback_data: 'op_help' },
        ],
      ],
    },
  };
}

function adminHelpText() {
  return [
    '<b>Admin — CRM</b>',
    '',
    '<b>Частые действия</b> — кнопки в панели.',
    '<b>Клиенты:</b> /add /remove /list /employees',
    '<b>Поиск:</b> CLT-000001 или +998...',
    '<b>Профиль:</b> /set &lt;tel&gt; &lt;поле&gt; &lt;значение&gt;',
    '/employee &lt;tel&gt; — карточка клиента',
    '/picktags &lt;tel&gt; — назначить тег (нужно фото)',
    '/tag &lt;tel&gt; &lt;teg_id&gt; — после выбора отправьте фото',
    '',
    '<b>Теги = действия клиента</b> (паспорт, договор и т.д.)',
    'К каждому тегу прикрепляется фото-подтверждение.',
    '',
    '<b>Теги:</b> /addtag /removetag /listtags',
    '<b>Операторы:</b> /addoperator &lt;id&gt; Имя',
    '<b>Экспорт:</b> /export',
  ].join('\n');
}

function operatorHelpText() {
  return [
    '<b>Operator — CRM</b>',
    '',
    'Кнопки панели — основные действия.',
    '/add +998... — новый клиент (только ваши)',
    '/employees — только клиенты, которых вы внесли',
    'Поиск: CLT-000001 или телефон',
    '/picktags +998... — тег + фото подтверждения',
    '',
    'Вы видите только своих клиентов.',
    'Полный отчёт — только у админов.',
  ].join('\n');
}

function formatTagsList(emp) {
  if (!emp.tags?.length) return '—';
  return emp.tags
    .map(t => {
      const photo = t.photo?.path ? ' 📎' : '';
      return `• ${t.label}${photo} <i>(${formatTagTime(t.assignedAt)})</i>`;
    })
    .join('\n');
}

function formatEmployee(emp) {
  const cards = emp.allowedCards?.length
    ? emp.allowedCards.map(c => `  • <code>${maskCard(c)}</code>`).join('\n')
    : '  —';

  return [
    `<b>${emp.fullName || '—'}</b>`,
    `ID: <code>${emp.clientId || '—'}</code>`,
    `Телефон: <code>${emp.phone}</code>`,
    `Оператор: ${emp.operator || '—'}`,
    `Теги (действия):\n${formatTagsList(emp)}`,
    `Сотрудник ID: ${emp.employeeId || '—'}`,
    `Должность: ${emp.position || '—'}`,
    `Отдел: ${emp.department || '—'}`,
    `Стаж: ${emp.tenure || '—'}`,
    `Аванс: ${formatMoney(emp.advanceBalance)} сум`,
    `Создан: ${emp.createdAt ? formatTagTime(emp.createdAt) : '—'} (${emp.createdByName || '—'})`,
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
      return `• <code>${e.clientId || '—'}</code> <code>${e.phone}</code> — ${e.fullName || '—'} | ${tags}`;
    }),
  ].join('\n');
}

function formatPhoneList() {
  const phones = listPhones();
  if (!phones.length) return 'Телефоны пусты.';
  return [`<b>Телефоны (${phones.length})</b>`, '', ...phones.map(p => `• <code>${p}</code>`)].join('\n');
}

function formatOperatorsList() {
  const ops = listOperators();
  if (!ops.length) return 'Операторы пусты.';
  return [
    `<b>Операторы (${ops.length})</b>`,
    '',
    ...ops.map(o =>
      `• <b>${o.name}</b>${o.telegramId ? ` — <code>${o.telegramId}</code>` : ' — ID не привязан'}`,
    ),
  ].join('\n');
}

function formatTagsCatalog() {
  const tags = listTags();
  return [
    `<b>Теги — действия клиента (${tags.length})</b>`,
    '',
    ...tags.map(t => `• <code>${t.id}</code> — ${t.label}${t.description ? `\n  <i>${t.description}</i>` : ''}`),
    '',
    '<i>Назначение тега требует фото-подтверждения.</i>',
  ].join('\n');
}

function formatAdminsList() {
  return [
    `<b>Админы (${listAdmins().length})</b>`,
    '',
    ...listAdmins().map(id => `• <code>${id}</code>${isEnvAdmin(id) ? ' (ENV)' : ''}`),
  ].join('\n');
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

function webAppUrl() {
  return process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app';
}

function miniAppReplyKeyboard() {
  return {
    keyboard: [[{ text: '📱 Shaxsiy kabinetni ochish', web_app: { url: webAppUrl() } }]],
    resize_keyboard: true,
  };
}

function miniAppInlineKeyboard() {
  return {
    inline_keyboard: [[{ text: '📱 Shaxsiy kabinet', web_app: { url: webAppUrl() } }]],
  };
}

function phoneDigits(phone) {
  return normalizePhone(phone)?.replace(/\D/g, '') || '';
}

function employeeActionsKeyboard(phone, telegramId) {
  const digits = phoneDigits(phone);
  return {
    inline_keyboard: [
      [
        { text: '🏷 Теги + фото', callback_data: `pick_tg:${digits}` },
        { text: '📎 Фото тегов', callback_data: `tag_photos:${digits}` },
      ],
      ...(isAdmin(telegramId) ? [[
        { text: '👔 Оператор', callback_data: `pick_op:${digits}` },
        { text: '📊 Экспорт', callback_data: 'admin_export' },
      ]] : []),
      [{ text: '◀️ Панель', callback_data: isAdmin(telegramId) ? 'adm_panel' : 'op_panel' }],
    ],
  };
}

function clientPickerKeyboard(employees, prefix) {
  const rows = employees.slice(0, 40).map(e => [{
    text: `${e.clientId || '—'} · ${e.fullName || e.phone}`,
    callback_data: `${prefix}:${phoneDigits(e.phone)}`,
  }]);
  if (!rows.length) {
    rows.push([{ text: '— пусто —', callback_data: 'noop' }]);
  }
  rows.push([{ text: '◀️ Панель', callback_data: 'noop_panel' }]);
  return { inline_keyboard: rows };
}

function operatorPickerKeyboard(phone) {
  const digits = phoneDigits(phone);
  const ops = listOperatorNames();
  const rows = [];
  for (let i = 0; i < ops.length; i += 2) {
    const row = [{ text: ops[i], callback_data: `op:${i}:${digits}` }];
    if (ops[i + 1]) row.push({ text: ops[i + 1], callback_data: `op:${i + 1}:${digits}` });
    rows.push(row);
  }
  rows.push([{ text: '✏️ Другое имя', callback_data: `op_c:${digits}` }]);
  return { inline_keyboard: rows };
}

function tagPickerKeyboard(phone, emp) {
  const digits = phoneDigits(phone);
  const tags = listTags();
  const rows = tags.map(t => {
    const existing = getClientTag(emp, t.id);
    const text = existing?.photo ? `📎 ${t.label}` : `➕ ${t.label}`;
    const action = existing?.photo ? 'tag_view' : 'tag_pick';
    return [{ text, callback_data: `${action}:${t.id}:${digits}` }];
  });
  rows.push([{ text: '◀️ Назад', callback_data: `view_cl:${digits}` }]);
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

async function sendExport(bot, chatId) {
  const buf = buildExcelBuffer();
  const res = await bot.sendDocument(chatId, buf, getExportFilename());
  if (!res.ok) {
    await bot.sendMessage(chatId, `❌ ${res.description || 'Ошибка экспорта'}`);
    return;
  }
  const note = isSheetsConfigured()
    ? '\n\n📊 Google Sheets обновлён.'
    : '';
  await bot.sendMessage(chatId, `✅ Полный отчёт отправлен.${note}`);
}

function resolveClientQuery(query, telegramId) {
  const q = String(query || '').trim();
  let emp = null;
  if (/^CLT-/i.test(q)) {
    emp = findEmployeeByClientId(q);
  } else {
    emp = getEmployee(normalizePhone(q));
  }
  if (!emp?.phone) throw new Error('Клиент не найден');
  if (!canViewClient(telegramId, emp)) throw new Error('Нет доступа к этому клиенту');
  return emp;
}

function requireClientAccess(fromId, phone) {
  const emp = getEmployee(phone);
  if (!canManageClient(fromId, emp)) {
    throw new Error('Нет доступа к этому клиенту');
  }
  return emp;
}

async function sendTagPhoto(bot, chatId, emp, tagId) {
  const tag = getClientTag(emp, tagId);
  if (!tag?.photo) throw new Error('Фото не найдено');

  const caption = `${emp.clientId} · ${tag.label}\n${formatTagTime(tag.assignedAt)}`;

  if (tag.photo.path) {
    const abs = attachmentAbsolutePath(tag.photo.path);
    const res = await bot.sendPhotoFile(chatId, abs, caption);
    if (!res.ok) throw new Error(res.description || 'Не удалось отправить фото');
    return;
  }

  if (tag.photo.fileId) {
    const res = await bot.sendPhoto(chatId, tag.photo.fileId, { caption });
    if (!res.ok) throw new Error(res.description || 'Не удалось отправить фото');
  }
}

function extractFileId(msg) {
  if (msg.photo?.length) return msg.photo[msg.photo.length - 1].file_id;
  if (msg.document?.mime_type?.startsWith('image/')) return msg.document.file_id;
  return null;
}

async function handleMediaMessage(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const pending = pendingTagPhoto.get(chatId);

  if (!pending) return;
  if (!hasStaffAccess(fromId)) {
    pendingTagPhoto.delete(chatId);
    return;
  }

  const fileId = extractFileId(msg);
  if (!fileId) {
    await bot.sendMessage(chatId, '❌ Отправьте фото (изображение).');
    return;
  }

  try {
    const emp = requireClientAccess(fromId, pending.phone);
    const photo = await saveTelegramFile(bot, fileId, emp.clientId, pending.tagId);
    const actor = getActor(fromId, msg.from.first_name);
    const updated = addClientTag(pending.phone, pending.tagId, actor, photo);
    pendingTagPhoto.delete(chatId);

    await bot.sendMessage(chatId, [
      `✅ Тег <b>${pending.tagLabel}</b> назначен`,
      `Клиент: <code>${updated.clientId}</code>`,
      '',
      formatEmployee(updated),
    ].join('\n'), { reply_markup: employeeActionsKeyboard(updated.phone, fromId) });
  } catch (e) {
    await bot.sendMessage(chatId, `❌ ${e.message}`);
  }
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;
  const actor = getActor(fromId, msg.from.first_name);

  if (pendingTagPhoto.has(chatId) && !text.startsWith('/')) {
    await bot.sendMessage(chatId, '📷 Ожидаю фото для тега. Отправьте изображение или /cancel');
    return;
  }

  if (text === '/cancel') {
    pendingCustomOperator.delete(chatId);
    pendingAddClient.delete(chatId);
    pendingFindClient.delete(chatId);
    pendingTagPhoto.delete(chatId);
    await bot.sendMessage(chatId, 'Отменено.', panelKeyboard(fromId));
    return;
  }

  if (pendingCustomOperator.has(chatId) && !text.startsWith('/')) {
    const phone = pendingCustomOperator.get(chatId);
    pendingCustomOperator.delete(chatId);
    try {
      requireClientAccess(fromId, phone);
      const emp = setEmployeeOperator(phone, text);
      await bot.sendMessage(chatId, `✅ Оператор: <b>${emp.operator}</b>\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (pendingAddClient.has(chatId) && !text.startsWith('/')) {
    pendingAddClient.delete(chatId);
    if (!hasStaffAccess(fromId)) return;
    try {
      const phone = addPhone(text, actor);
      const emp = getEmployee(phone);
      await bot.sendMessage(chatId, [
        `✅ Клиент добавлен`,
        `ID: <code>${emp.clientId}</code>`,
        `Телефон: <code>${phone}</code>`,
      ].join('\n'), { reply_markup: employeeActionsKeyboard(phone, fromId) });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (pendingFindClient.has(chatId) && !text.startsWith('/')) {
    pendingFindClient.delete(chatId);
    try {
      const emp = resolveClientQuery(text, fromId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (text === '/start') {
    await bot.sendMessage(chatId, [
      '<b>Uztronix CRM</b>',
      '',
      'Личный кабинет — Mini App.',
      'Операторы и админы — панель управления.',
    ].join('\n'), { reply_markup: miniAppReplyKeyboard() });
    await bot.sendMessage(chatId, 'Mini App:', { reply_markup: miniAppInlineKeyboard() });

    if (isAdmin(fromId)) {
      await bot.sendMessage(chatId, '<b>Панель администратора</b>', adminKeyboard());
    } else if (hasStaffAccess(fromId)) {
      await bot.sendMessage(chatId, '<b>Панель оператора</b>', operatorKeyboard());
    }
    return;
  }

  if (text === '/admin' && isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Панель администратора</b>', adminKeyboard());
    return;
  }

  if ((text === '/panel' || text === '/operator') && hasStaffAccess(fromId) && !isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Панель оператора</b>', operatorKeyboard());
    return;
  }

  if (!text.startsWith('/')) return;

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === '/help') {
    if (!hasStaffAccess(fromId)) {
      await bot.sendMessage(chatId, '⛔ Нет доступа.');
      return;
    }
    await bot.sendMessage(chatId, isAdmin(fromId) ? adminHelpText() : operatorHelpText(), panelKeyboard(fromId));
    return;
  }

  if (cmd === '/export') {
    if (!canExport(fromId)) {
      await bot.sendMessage(chatId, '⛔ Полный отчёт только для админов.');
      return;
    }
    await sendExport(bot, chatId);
    return;
  }

  if (!hasStaffAccess(fromId)) {
    await bot.sendMessage(chatId, '⛔ Нет доступа.');
    return;
  }

  if (cmd === '/find' && parts[1]) {
    try {
      const emp = resolveClientQuery(parts.slice(1).join(' '), fromId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/list' || cmd === '/employees') {
    await bot.sendMessage(chatId, formatEmployeesList(fromId), panelKeyboard(fromId));
    return;
  }

  if (cmd === '/listtags' || cmd === '/liststages') {
    await bot.sendMessage(chatId, formatTagsCatalog(), panelKeyboard(fromId));
    return;
  }

  if (isAdmin(fromId) && cmd === '/listadmins') {
    await bot.sendMessage(chatId, formatAdminsList(), adminKeyboard());
    return;
  }

  if (isAdmin(fromId) && cmd === '/listoperators') {
    await bot.sendMessage(chatId, formatOperatorsList(), adminKeyboard());
    return;
  }

  if (isAdmin(fromId) && (cmd === '/add' || cmd === '/remove') && parts[1]) {
    try {
      if (cmd === '/add') {
        const phone = addPhone(parts[1], actor);
        const emp = getEmployee(phone);
        await bot.sendMessage(chatId, `✅ Добавлен: <code>${emp.clientId}</code> · <code>${phone}</code>`);
      } else {
        const phone = removePhone(parts[1]);
        await bot.sendMessage(chatId, `✅ Удалён: <code>${phone}</code>`);
      }
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (!isAdmin(fromId) && cmd === '/add' && parts[1]) {
    try {
      const phone = addPhone(parts[1], actor);
      const emp = getEmployee(phone);
      await bot.sendMessage(chatId, [
        `✅ Клиент добавлен`,
        `ID: <code>${emp.clientId}</code>`,
        `Телефон: <code>${phone}</code>`,
      ].join('\n'), { reply_markup: employeeActionsKeyboard(phone, fromId) });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/addoperator') {
    try {
      const tid = /^\d+$/.test(parts[1]) ? parts[1] : null;
      const name = tid ? parts.slice(2).join(' ') : parts.slice(1).join(' ');
      const op = tid ? addOperator(name, tid) : addOperator(name);
      await bot.sendMessage(chatId, `✅ Оператор: <b>${op.name}</b>${op.telegramId ? ` (<code>${op.telegramId}</code>)` : ''}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/linkoperator' && parts[2]) {
    try {
      const op = linkOperator(parts[1], parts.slice(2).join(' '));
      await bot.sendMessage(chatId, `✅ Привязан: <b>${op.name}</b> → <code>${op.telegramId}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removeoperator' && parts[1]) {
    try {
      removeOperator(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, '✅ Оператор удалён');
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (canManageTagDefinitions(fromId) && (cmd === '/addtag' || cmd === '/addstage') && parts[1]) {
    try {
      const t = addTag(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, `✅ Тег: <b>${t.label}</b> (<code>${t.id}</code>)`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && (cmd === '/removetag' || cmd === '/removestage') && parts[1]) {
    try {
      removeTag(parts[1]);
      await bot.sendMessage(chatId, `✅ Тег удалён: <code>${parts[1]}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/addadmin' && parts[1]) {
    try {
      await bot.sendMessage(chatId, `✅ Админ: <code>${addAdmin(parts[1])}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removeadmin' && parts[1]) {
    try {
      await bot.sendMessage(chatId, `✅ Удалён: <code>${removeAdmin(parts[1])}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/employee' && parts[1]) {
    try {
      const emp = resolveClientQuery(parts[1], fromId);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if ((cmd === '/picktags' || cmd === '/pickstage') && parts[1]) {
    try {
      const emp = requireClientAccess(fromId, parts[1]);
      await bot.sendMessage(chatId, `Теги — <code>${emp.clientId}</code>\n(нужно фото-подтверждение):`, {
        reply_markup: tagPickerKeyboard(emp.phone, emp),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/tag' && parts[2]) {
    try {
      const emp = requireClientAccess(fromId, parts[1]);
      const tag = listTags().find(t => t.id === parts[2]);
      if (!tag) throw new Error('Неизвестный тег');
      pendingTagPhoto.set(chatId, { phone: emp.phone, tagId: tag.id, tagLabel: tag.label });
      await bot.sendMessage(chatId, `📷 Отправьте фото для тега <b>${tag.label}</b>\nКлиент: <code>${emp.clientId}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/untag' && parts[2] && isAdmin(fromId)) {
    try {
      const emp = requireClientAccess(fromId, parts[1]);
      const updated = removeClientTag(parts[1], parts[2], actor);
      await bot.sendMessage(chatId, `✅ Тег снят\n\n${formatEmployee(updated)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/pickoperator' && parts[1] && isAdmin(fromId)) {
    const phone = normalizePhone(parts[1]);
    if (!phone) return bot.sendMessage(chatId, '❌ Неверный телефон');
    await bot.sendMessage(chatId, `Оператор — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (cmd === '/set' && parts.length >= 4) {
    try {
      requireClientAccess(fromId, parts[1]);
      const emp = setEmployeeField(parts[1], parts[2], parts.slice(3).join(' '));
      await bot.sendMessage(chatId, `✅ Обновлено\n\n${formatEmployee(emp)}`, {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/addcard' && parts[2]) {
    try {
      const card = addEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ Карта: <code>${maskCard(card)}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removecard' && parts[2]) {
    try {
      const card = removeEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ Удалена: <code>${maskCard(card)}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  await bot.sendMessage(chatId, 'Неизвестная команда. /help', panelKeyboard(fromId));
}

async function handleCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const fromId = query.from?.id;
  const data = query.data || '';

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

  if (data === 'op_panel' && hasStaffAccess(fromId) && !isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, '<b>Панель оператора</b>', operatorKeyboard());
    return;
  }

  if (data === 'admin_export') {
    if (!canExport(fromId)) {
      await bot.answerCallbackQuery(query.id, 'Только админ');
      return;
    }
    await bot.answerCallbackQuery(query.id, 'Готовлю...');
    await sendExport(bot, chatId);
    return;
  }

  if (!hasStaffAccess(fromId) && !data.startsWith('admin_') && !data.startsWith('adm_') && !data.startsWith('op_')) {
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

  if (data === 'op_my_leads' || data === 'admin_employees') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatEmployeesList(fromId), panelKeyboard(fromId));
    return;
  }

  if (data === 'admin_list' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatPhoneList(), adminKeyboard());
    return;
  }

  if (data === 'admin_tags') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatTagsCatalog(), panelKeyboard(fromId));
    return;
  }

  if (data === 'admin_operators' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatOperatorsList(), adminKeyboard());
    return;
  }

  if (data === 'admin_admins' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatAdminsList(), adminKeyboard());
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
    pendingAddClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Введите телефон нового лида:\n<code>+998901234567</code>\n\n/cancel — отмена');
    return;
  }

  if (data === 'op_add') {
    pendingAddClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Введите телефон нового клиента:\n<code>+998901234567</code>\n\n/cancel — отмена');
    return;
  }

  if (data === 'adm_find' && isAdmin(fromId)) {
    pendingFindClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Поиск: <code>CLT-000001</code> или <code>+998...</code>\n\n/cancel — отмена');
    return;
  }

  if (data === 'op_find') {
    pendingFindClient.set(chatId, true);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Поиск: <code>CLT-000001</code> или <code>+998...</code>\n\n/cancel — отмена');
    return;
  }

  if (data === 'adm_tag_menu' && isAdmin(fromId)) {
    const employees = listEmployeesForUser(fromId);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Выберите клиента для назначения тега:', {
      reply_markup: clientPickerKeyboard(employees, 'tag_cl'),
    });
    return;
  }

  if (data === 'op_tag_menu') {
    const employees = listEmployeesForUser(fromId);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Выберите клиента для назначения тега:', {
      reply_markup: clientPickerKeyboard(employees, 'tag_cl'),
    });
    return;
  }

  if (data === 'admin_add_hint') {
    await bot.answerCallbackQuery(query.id);
    pendingAddClient.set(chatId, true);
    await bot.sendMessage(chatId, 'Введите телефон:\n<code>+998901234567</code>');
    return;
  }

  if (data.startsWith('tag_cl:')) {
    const phone = `+${data.slice(7)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Теги — <code>${emp.clientId}</code>:`, {
        reply_markup: tagPickerKeyboard(phone, emp),
      });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('view_cl:')) {
    const phone = `+${data.slice(8)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(phone, fromId),
      });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('pick_tg:')) {
    const phone = `+${data.slice(8)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Теги — <code>${emp.clientId}</code>:`, {
        reply_markup: tagPickerKeyboard(phone, emp),
      });
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
      await bot.sendMessage(chatId, `Фото тегов — <code>${emp.clientId}</code>:`, {
        reply_markup: tagPhotosKeyboard(phone, emp),
      });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('pick_op:') && isAdmin(fromId)) {
    const phone = `+${data.slice(8)}`;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Оператор — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (data.startsWith('tag_pick:')) {
    const rest = data.slice(9);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      const tag = listTags().find(t => t.id === tagId);
      if (!tag) throw new Error('Тег не найден');
      pendingTagPhoto.set(chatId, { phone, tagId, tagLabel: tag.label });
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, [
        `📷 Отправьте фото для тега <b>${tag.label}</b>`,
        `Клиент: <code>${emp.clientId}</code>`,
        '',
        '<i>Например: фото паспорта или подписанного договора</i>',
        '/cancel — отмена',
      ].join('\n'));
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
      await bot.answerCallbackQuery(query.id, 'Отправляю...');
      await sendTagPhoto(bot, chatId, emp, tagId);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('op_c:') && isAdmin(fromId)) {
    const phone = `+${data.slice(5)}`;
    pendingCustomOperator.set(chatId, phone);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Имя оператора (<code>${phone}</code>):`);
    return;
  }

  if (data.startsWith('op:') && isAdmin(fromId)) {
    const [, idxStr, digits] = data.split(':');
    const names = listOperatorNames();
    const name = names[Number(idxStr)];
    const phone = `+${digits}`;
    if (!name) {
      await bot.answerCallbackQuery(query.id, 'Ошибка');
      return;
    }
    try {
      const op = listOperators().find(o => o.name === name);
      const emp = setEmployeeOperator(phone, name, op?.id || '');
      await bot.answerCallbackQuery(query.id, name);
      await bot.sendMessage(chatId, `✅ Обновлено\n\n${formatEmployee(emp)}`);
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

  bot.setChatMenuButton({
    type: 'web_app',
    text: 'Shaxsiy kabinet',
    web_app: { url: webAppUrl() },
  }).catch(() => {});

  async function poll() {
    while (true) {
      try {
        const res = await bot.getUpdates(offset);
        if (res.ok && res.result?.length) {
          for (const update of res.result) {
            offset = update.update_id + 1;
            if (update.message) {
              if (update.message.photo || update.message.document) {
                await handleMediaMessage(bot, update.message);
              } else {
                await handleCommand(bot, update.message);
              }
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
