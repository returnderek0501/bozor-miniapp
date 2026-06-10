import {
  listPhones, addPhone, removePhone,
  getEmployee, setEmployeeField, listEmployeesForUser,
  addEmployeeCard, removeEmployeeCard, maskCard,
  setEmployeeOperator, normalizePhone, toggleClientTag,
  hasClientTag, addClientTag, removeClientTag,
} from './store.js';
import { isAdmin, listAdmins, addAdmin, removeAdmin, isEnvAdmin } from './admins.js';
import {
  listOperators, listOperatorNames, addOperator, removeOperator, linkOperator,
} from './operators.js';
import { listTags, addTag, removeTag, formatTagTime } from './tags.js';
import {
  getActor, hasStaffAccess, canExport, canManageClient, canManageTagDefinitions,
} from './permissions.js';
import { buildExcelBuffer, getExportFilename } from './export.js';
import { isSheetsConfigured } from './sheets.js';
import { createBotApi } from './telegram.js';

const pendingCustomOperator = new Map();

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Lidlar', callback_data: 'admin_list' },
          { text: '👤 Mijozlar', callback_data: 'admin_employees' },
        ],
        [
          { text: '📊 To\'liq hisobot', callback_data: 'admin_export' },
          { text: '🏷 Teglar', callback_data: 'admin_tags' },
        ],
        [
          { text: '👔 Operatorlar', callback_data: 'admin_operators' },
          { text: '🔑 Adminlar', callback_data: 'admin_admins' },
        ],
        [
          { text: '➕ Lid', callback_data: 'admin_add_hint' },
          { text: 'ℹ️ Yordam', callback_data: 'admin_help' },
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
          { text: '👤 Mening lidlarim', callback_data: 'op_my_leads' },
          { text: '🏷 Teglar', callback_data: 'admin_tags' },
        ],
        [
          { text: '➕ Lid qo\'shish', callback_data: 'admin_add_hint' },
          { text: 'ℹ️ Yordam', callback_data: 'op_help' },
        ],
      ],
    },
  };
}

function adminHelpText() {
  return [
    '<b>Admin — CRM</b>',
    '',
    '<b>Lidlar:</b> /add /remove /list /employees',
    '<b>Profil:</b> /set &lt;tel&gt; &lt;maydon&gt; &lt;qiymat&gt;',
    '/employee &lt;tel&gt; — kartochka + teg tugmalari',
    '/picktags &lt;tel&gt; — teglarni yoqish/o\'chirish',
    '/tag &lt;tel&gt; &lt;teg_id&gt; | /untag &lt;tel&gt; &lt;teg_id&gt;',
    '',
    '<b>Teglar:</b> /addtag /removetag /listtags',
    '<b>Operatorlar:</b> /addoperator &lt;id&gt; Ism | /linkoperator &lt;id&gt; Ism',
    '<b>Adminlar:</b> /addadmin /removeadmin /listadmins',
    '<b>Eksport:</b> /export (faqat admin)',
    '',
    '<i>Sheets:</i> ' + (isSheetsConfigured() ? 'real-time' : 'o\'chirilgan'),
  ].join('\n');
}

function operatorHelpText() {
  return [
    '<b>Operator — CRM</b>',
    '',
    '/add +998... — yangi lid (sizga biriktiriladi)',
    '/employees — mening lidlarim',
    '/employee +998... — kartochka',
    '/set +998... name ... — ma\'lumot yangilash',
    '/picktags +998... — teglar (bir nechta)',
    '/addtag YangiTeg — yangi teg yaratish',
    '/listtags — teglar ro\'yxati',
    '',
    'To\'liq hisobot faqat adminlarga.',
  ].join('\n');
}

function formatTagsList(emp) {
  if (!emp.tags?.length) return '—';
  return emp.tags
    .map(t => `• ${t.label} <i>(${formatTagTime(t.assignedAt)})</i>`)
    .join('\n');
}

function formatEmployee(emp) {
  const cards = emp.allowedCards?.length
    ? emp.allowedCards.map(c => `  • <code>${maskCard(c)}</code>`).join('\n')
    : '  —';

  return [
    `<b>${emp.fullName || '—'}</b>`,
    `Telefon: <code>${emp.phone}</code>`,
    `Operator: ${emp.operator || '—'}`,
    `Teglar:\n${formatTagsList(emp)}`,
    `ID: ${emp.employeeId || '—'}`,
    `Lavozim: ${emp.position || '—'}`,
    `Bo\'lim: ${emp.department || '—'}`,
    `Staj: ${emp.tenure || '—'}`,
    `Avans: ${formatMoney(emp.advanceBalance)} so\'m`,
    `Yaratilgan: ${emp.createdAt ? formatTagTime(emp.createdAt) : '—'} (${emp.createdByName || '—'})`,
    `Kartalar:\n${cards}`,
  ].join('\n');
}

function formatEmployeesList(telegramId) {
  const employees = listEmployeesForUser(telegramId);
  if (!employees.length) return 'Lidlar ro\'yxati bo\'sh.';
  return [
    `<b>Lidlar (${employees.length})</b>`,
    '',
    ...employees.map(e => {
      const tags = e.tags?.map(t => t.label).join(', ') || '—';
      return `• <code>${e.phone}</code> — ${e.fullName || '—'} | ${e.operator || '—'} | ${tags}`;
    }),
  ].join('\n');
}

function formatPhoneList(telegramId) {
  if (isAdmin(telegramId)) {
    const phones = listPhones();
    if (!phones.length) return 'Telefonlar bo\'sh.';
    return [`<b>Telefonlar (${phones.length})</b>`, '', ...phones.map(p => `• <code>${p}</code>`)].join('\n');
  }
  return formatEmployeesList(telegramId);
}

function formatOperatorsList() {
  const ops = listOperators();
  if (!ops.length) return 'Operatorlar bo\'sh.';
  return [
    `<b>Operatorlar (${ops.length})</b>`,
    '',
    ...ops.map(o =>
      `• <b>${o.name}</b>${o.telegramId ? ` — <code>${o.telegramId}</code>` : ' — ID ulanmagan'}`,
    ),
  ].join('\n');
}

function formatTagsCatalog() {
  const tags = listTags();
  return [
    `<b>Teglar (${tags.length})</b>`,
    '',
    ...tags.map(t => `• <code>${t.id}</code> — ${t.label}${t.description ? `\n  <i>${t.description}</i>` : ''}`),
  ].join('\n');
}

function formatAdminsList() {
  return [
    `<b>Adminlar (${listAdmins().length})</b>`,
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
  const rows = [[
    { text: '🏷 Teglar', callback_data: `pick_tg:${digits}` },
    { text: '👔 Operator', callback_data: `pick_op:${digits}` },
  ]];
  if (isAdmin(telegramId)) {
    rows.push([{ text: '📊 Hisobot', callback_data: 'admin_export' }]);
  }
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
  rows.push([{ text: '✏️ Boshqa ism', callback_data: `op_c:${digits}` }]);
  return { inline_keyboard: rows };
}

function tagPickerKeyboard(phone, emp) {
  const digits = phoneDigits(phone);
  const tags = listTags();
  const rows = tags.map(t => {
    const active = hasClientTag(emp, t.id);
    return [{
      text: `${active ? '✓ ' : ''}${t.label}`,
      callback_data: `tg:${t.id}:${digits}`,
    }];
  });
  return { inline_keyboard: rows };
}

async function sendExport(bot, chatId) {
  const buf = buildExcelBuffer();
  const res = await bot.sendDocument(chatId, buf, getExportFilename());
  if (!res.ok) {
    await bot.sendMessage(chatId, `❌ ${res.description || 'Eksport xatosi'}`);
    return;
  }
  const note = isSheetsConfigured()
    ? '\n\n📊 Google Sheets yangilandi (barcha operatorlar bo\'yicha ajratilgan).'
    : '';
  await bot.sendMessage(chatId, `✅ To\'liq hisobot yuborildi.${note}`);
}

function requireClientAccess(fromId, phone) {
  const emp = getEmployee(phone);
  if (!canManageClient(fromId, emp)) {
    throw new Error('Ushbu lid uchun ruxsat yo\'q');
  }
  return emp;
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;
  const actor = getActor(fromId, msg.from.first_name);

  if (pendingCustomOperator.has(chatId) && !text.startsWith('/')) {
    const phone = pendingCustomOperator.get(chatId);
    pendingCustomOperator.delete(chatId);
    try {
      requireClientAccess(fromId, phone);
      const emp = setEmployeeOperator(phone, text);
      await bot.sendMessage(chatId, `✅ Operator: <b>${emp.operator}</b>\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (text === '/start') {
    await bot.sendMessage(chatId, [
      '<b>Uztronix CRM</b>',
      '',
      'Shaxsiy kabinet — Mini App.',
      'Operatorlar — lidlar va teglar boshqaruvi.',
    ].join('\n'), { reply_markup: miniAppReplyKeyboard() });
    await bot.sendMessage(chatId, 'Mini App:', { reply_markup: miniAppInlineKeyboard() });

    if (isAdmin(fromId)) {
      await bot.sendMessage(chatId, 'Admin paneli:', adminKeyboard());
    } else if (hasStaffAccess(fromId)) {
      await bot.sendMessage(chatId, 'Operator paneli:', operatorKeyboard());
    }
    return;
  }

  if (text === '/admin' && isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Admin paneli</b>', adminKeyboard());
    return;
  }

  if (text === '/panel' && hasStaffAccess(fromId) && !isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Operator paneli</b>', operatorKeyboard());
    return;
  }

  if (!text.startsWith('/')) return;

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === '/help') {
    if (!hasStaffAccess(fromId)) {
      await bot.sendMessage(chatId, '⛔ Ruxsat yo\'q.');
      return;
    }
    await bot.sendMessage(chatId, isAdmin(fromId) ? adminHelpText() : operatorHelpText());
    return;
  }

  if (cmd === '/export') {
    if (!canExport(fromId)) {
      await bot.sendMessage(chatId, '⛔ To\'liq hisobot faqat adminlarga.');
      return;
    }
    await sendExport(bot, chatId);
    return;
  }

  if (!hasStaffAccess(fromId)) {
    await bot.sendMessage(chatId, '⛔ Ruxsat yo\'q.');
    return;
  }

  if (cmd === '/list' || cmd === '/employees') {
    await bot.sendMessage(chatId, formatEmployeesList(fromId));
    return;
  }

  if (cmd === '/listtags' || cmd === '/liststages') {
    await bot.sendMessage(chatId, formatTagsCatalog());
    return;
  }

  if (isAdmin(fromId) && cmd === '/listadmins') {
    await bot.sendMessage(chatId, formatAdminsList());
    return;
  }

  if (isAdmin(fromId) && cmd === '/listoperators') {
    await bot.sendMessage(chatId, formatOperatorsList());
    return;
  }

  if (isAdmin(fromId) && (cmd === '/add' || cmd === '/remove') && parts[1]) {
    try {
      if (cmd === '/add') {
        const phone = addPhone(parts[1], actor);
        await bot.sendMessage(chatId, `✅ Qo\'shildi: <code>${phone}</code>`);
      } else {
        const phone = removePhone(parts[1]);
        await bot.sendMessage(chatId, `✅ O\'chirildi: <code>${phone}</code>`);
      }
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (!isAdmin(fromId) && cmd === '/add' && parts[1]) {
    try {
      const phone = addPhone(parts[1], actor);
      await bot.sendMessage(chatId, `✅ Lid qo\'shildi: <code>${phone}</code>\nOperator: <b>${actor?.operatorName || actor?.name}</b>`);
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
      await bot.sendMessage(chatId, `✅ Operator: <b>${op.name}</b>${op.telegramId ? ` (<code>${op.telegramId}</code>)` : ''}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/linkoperator' && parts[2]) {
    try {
      const op = linkOperator(parts[1], parts.slice(2).join(' '));
      await bot.sendMessage(chatId, `✅ Bog\'landi: <b>${op.name}</b> → <code>${op.telegramId}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removeoperator' && parts[1]) {
    try {
      removeOperator(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, '✅ Operator o\'chirildi');
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (canManageTagDefinitions(fromId) && (cmd === '/addtag' || cmd === '/addstage') && parts[1]) {
    try {
      const t = addTag(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, `✅ Teg: <b>${t.label}</b> (<code>${t.id}</code>)`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && (cmd === '/removetag' || cmd === '/removestage') && parts[1]) {
    try {
      removeTag(parts[1]);
      await bot.sendMessage(chatId, `✅ Teg o\'chirildi: <code>${parts[1]}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/addadmin' && parts[1]) {
    try {
      await bot.sendMessage(chatId, `✅ Admin: <code>${addAdmin(parts[1])}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removeadmin' && parts[1]) {
    try {
      await bot.sendMessage(chatId, `✅ O\'chirildi: <code>${removeAdmin(parts[1])}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/employee' && parts[1]) {
    try {
      const emp = requireClientAccess(fromId, parts[1]);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: employeeActionsKeyboard(emp.phone, fromId),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/picktags' || cmd === '/pickstage') && parts[1]) {
    try {
      const emp = requireClientAccess(fromId, parts[1]);
      await bot.sendMessage(chatId, `Teglar — <code>${emp.phone}</code>\n(bir nechta tanlash mumkin):`, {
        reply_markup: tagPickerKeyboard(emp.phone, emp),
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/tag' && parts[2]) {
    try {
      requireClientAccess(fromId, parts[1]);
      const emp = addClientTag(parts[1], parts[2], actor);
      await bot.sendMessage(chatId, `✅ Teg qo\'shildi\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/untag' && parts[2]) {
    try {
      requireClientAccess(fromId, parts[1]);
      const emp = removeClientTag(parts[1], parts[2], actor);
      await bot.sendMessage(chatId, `✅ Teg olib tashlandi\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/pickoperator' && parts[1] && isAdmin(fromId)) {
    const phone = normalizePhone(parts[1]);
    if (!phone) return bot.sendMessage(chatId, '❌ Noto\'g\'ri telefon');
    await bot.sendMessage(chatId, `Operator — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (cmd === '/set' && parts.length >= 4) {
    try {
      requireClientAccess(fromId, parts[1]);
      const emp = setEmployeeField(parts[1], parts[2], parts.slice(3).join(' '));
      await bot.sendMessage(chatId, `✅ Yangilandi\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/addcard' && parts[2]) {
    try {
      const card = addEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ Karta: <code>${maskCard(card)}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (isAdmin(fromId) && cmd === '/removecard' && parts[2]) {
    try {
      const card = removeEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ O\'chirildi: <code>${maskCard(card)}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  await bot.sendMessage(chatId, 'Noma\'lum buyruq. /help');
}

async function handleCallback(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const fromId = query.from?.id;
  const data = query.data || '';
  const actor = getActor(fromId, query.from?.first_name);

  if (data === 'admin_export') {
    if (!canExport(fromId)) {
      await bot.answerCallbackQuery(query.id, 'Faqat admin');
      return;
    }
    await bot.answerCallbackQuery(query.id, 'Tayyorlanmoqda...');
    await sendExport(bot, chatId);
    return;
  }

  if (!hasStaffAccess(fromId) && !data.startsWith('admin_')) {
    await bot.answerCallbackQuery(query.id, 'Ruxsat yo\'q');
    return;
  }

  if (data === 'op_my_leads' || data === 'admin_employees') {
    await bot.answerCallbackQuery(query.id);
    const kb = isAdmin(fromId) ? adminKeyboard() : operatorKeyboard();
    await bot.editMessageText(chatId, messageId, formatEmployeesList(fromId), kb);
    return;
  }

  if (data === 'admin_list' && isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatPhoneList(fromId), adminKeyboard());
    return;
  }

  if (data === 'admin_tags') {
    await bot.answerCallbackQuery(query.id);
    const kb = isAdmin(fromId) ? adminKeyboard() : operatorKeyboard();
    await bot.editMessageText(chatId, messageId, formatTagsCatalog(), kb);
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

  if (data === 'admin_add_hint') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Lid qo\'shish:\n<code>/add +998901234567</code>');
    return;
  }

  if (data.startsWith('pick_tg:')) {
    const phone = `+${data.slice(8)}`;
    try {
      const emp = requireClientAccess(fromId, phone);
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId, `Teglar — <code>${phone}</code>:`, {
        reply_markup: tagPickerKeyboard(phone, emp),
      });
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('pick_op:') && isAdmin(fromId)) {
    const phone = `+${data.slice(8)}`;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Operator — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (data.startsWith('tg:')) {
    const rest = data.slice(3);
    const lastColon = rest.lastIndexOf(':');
    const tagId = rest.slice(0, lastColon);
    const phone = `+${rest.slice(lastColon + 1)}`;
    try {
      requireClientAccess(fromId, phone);
      const emp = toggleClientTag(phone, tagId, actor);
      const active = hasClientTag(emp, tagId);
      await bot.answerCallbackQuery(query.id, active ? 'Qo\'shildi' : 'Olib tashlandi');
      await bot.editMessageReplyMarkup(chatId, messageId, tagPickerKeyboard(phone, emp));
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('op_c:') && isAdmin(fromId)) {
    const phone = `+${data.slice(5)}`;
    pendingCustomOperator.set(chatId, phone);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Operator ismi (<code>${phone}</code>):`);
    return;
  }

  if (data.startsWith('op:') && isAdmin(fromId)) {
    const [, idxStr, digits] = data.split(':');
    const names = listOperatorNames();
    const name = names[Number(idxStr)];
    const phone = `+${digits}`;
    if (!name) {
      await bot.answerCallbackQuery(query.id, 'Xato');
      return;
    }
    try {
      const op = listOperators().find(o => o.name === name);
      const emp = setEmployeeOperator(phone, name, op?.id || '');
      await bot.answerCallbackQuery(query.id, name);
      await bot.sendMessage(chatId, `✅ Yangilandi\n\n${formatEmployee(emp)}`);
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
            if (update.message) await handleCommand(bot, update.message);
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
