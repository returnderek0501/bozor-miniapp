import {
  listPhones, addPhone, removePhone,
  getEmployee, setEmployeeField, listEmployees,
  addEmployeeCard, removeEmployeeCard, maskCard,
  setEmployeeOperator, setEmployeeStage, normalizePhone,
} from './store.js';
import { isAdmin, listAdmins, addAdmin, removeAdmin, isEnvAdmin } from './admins.js';
import { listOperators, addOperator, removeOperator } from './operators.js';
import { listStages, addStage, removeStage, getStageLabel } from './stages.js';
import { buildExcelBuffer, getExportFilename } from './export.js';
import { isSheetsConfigured } from './sheets.js';
import { createBotApi } from './telegram.js';

const pendingOperatorPhone = new Map();

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Telefonlar', callback_data: 'admin_list' },
          { text: '👤 Xodimlar', callback_data: 'admin_employees' },
        ],
        [
          { text: '📊 Excel', callback_data: 'admin_export' },
          { text: '👔 Operatorlar', callback_data: 'admin_operators' },
        ],
        [
          { text: '📌 Etaplar', callback_data: 'admin_stages' },
          { text: '🔑 Adminlar', callback_data: 'admin_admins' },
        ],
        [
          { text: '➕ Telefon', callback_data: 'admin_add_hint' },
          { text: 'ℹ️ Yordam', callback_data: 'admin_help' },
        ],
      ],
    },
  };
}

function helpText() {
  return [
    '<b>Uztronix — boshqaruv</b>',
    '',
    '<b>Telefonlar:</b> /add /remove /list',
    '<b>Profil:</b> /set &lt;tel&gt; &lt;maydon&gt; &lt;qiymat&gt;',
    '  maydonlar: name, position, dept, tenure, balance, id, operator, stage',
    '/employee &lt;tel&gt; — profil',
    '/pickoperator &lt;tel&gt; — operator tanlash (tugmalar)',
    '/pickstage &lt;tel&gt; — etap tanlash (tugmalar)',
    '',
    '<b>Operatorlar:</b> /addoperator /removeoperator /listoperators',
    '<b>Etaplar:</b> /addstage /removestage /liststages',
    '<b>Kartalar:</b> /addcard /removecard',
    '',
    '<b>Adminlar:</b> /addadmin /removeadmin /listadmins',
    '<b>Eksport:</b> /export — Excel fayl',
    '',
    '<i>Google Sheets:</i> ' + (isSheetsConfigured() ? 'yoqilgan (real-time)' : 'o\'chirilgan'),
  ].join('\n');
}

function formatPhoneList() {
  const phones = listPhones();
  if (!phones.length) return 'Telefonlar ro\'yxati bo\'sh.';
  return [`<b>Telefonlar (${phones.length})</b>`, '', ...phones.map(p => `• <code>${p}</code>`)].join('\n');
}

function formatEmployee(emp) {
  const cards = emp.allowedCards?.length
    ? emp.allowedCards.map(c => `  • <code>${maskCard(c)}</code>`).join('\n')
    : '  —';

  return [
    `<b>${emp.fullName || '—'}</b>`,
    `Telefon: <code>${emp.phone}</code>`,
    `ID: ${emp.employeeId || '—'}`,
    `Lavozim: ${emp.position || '—'}`,
    `Bo\'lim: ${emp.department || '—'}`,
    `Staj: ${emp.tenure || '—'}`,
    `Operator: ${emp.operator || '—'}`,
    `Etap: ${getStageLabel(emp.stage)}`,
    `Avans: ${formatMoney(emp.advanceBalance)} so\'m`,
    `Kartalar:\n${cards}`,
  ].join('\n');
}

function formatEmployeesList() {
  const employees = listEmployees();
  if (!employees.length) return 'Xodimlar ro\'yxati bo\'sh.';
  return [
    `<b>Xodimlar (${employees.length})</b>`,
    '',
    ...employees.map(e =>
      `• <code>${e.phone}</code> — ${e.fullName || '—'} | ${e.operator || '—'} | ${getStageLabel(e.stage)}`,
    ),
  ].join('\n');
}

function formatOperatorsList() {
  const ops = listOperators();
  if (!ops.length) return 'Operatorlar ro\'yxati bo\'sh.';
  return [`<b>Operatorlar (${ops.length})</b>`, '', ...ops.map(o => `• ${o}`)].join('\n');
}

function formatStagesList() {
  const stages = listStages();
  return [
    `<b>Etaplar (${stages.length})</b>`,
    '',
    ...stages.map(s => `• <code>${s.id}</code> — ${s.label}${s.description ? `\n  <i>${s.description}</i>` : ''}`),
  ].join('\n');
}

function formatAdminsList() {
  const admins = listAdmins();
  return [
    `<b>Adminlar (${admins.length})</b>`,
    '',
    ...admins.map(id => `• <code>${id}</code>${isEnvAdmin(id) ? ' (ENV)' : ''}`),
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
    keyboard: [[{
      text: '📱 Shaxsiy kabinetni ochish',
      web_app: { url: webAppUrl() },
    }]],
    resize_keyboard: true,
  };
}

function miniAppInlineKeyboard() {
  return {
    inline_keyboard: [[{
      text: '📱 Shaxsiy kabinet',
      web_app: { url: webAppUrl() },
    }]],
  };
}

function phoneDigits(phone) {
  return normalizePhone(phone)?.replace(/\D/g, '') || '';
}

function operatorPickerKeyboard(phone) {
  const digits = phoneDigits(phone);
  const ops = listOperators();
  const rows = [];

  for (let i = 0; i < ops.length; i += 2) {
    const row = [{ text: ops[i], callback_data: `op:${i}:${digits}` }];
    if (ops[i + 1]) row.push({ text: ops[i + 1], callback_data: `op:${i + 1}:${digits}` });
    rows.push(row);
  }
  rows.push([{ text: '✏️ Boshqa ism', callback_data: `op_c:${digits}` }]);
  return { inline_keyboard: rows };
}

function stagePickerKeyboard(phone) {
  const digits = phoneDigits(phone);
  const stages = listStages();
  const rows = stages.map(s => ([{
    text: s.label,
    callback_data: `st:${s.id}:${digits}`,
  }]));
  return { inline_keyboard: rows };
}

async function sendExport(bot, chatId) {
  const buf = buildExcelBuffer();
  const filename = getExportFilename();
  const res = await bot.sendDocument(chatId, buf, filename);
  if (!res.ok) {
    await bot.sendMessage(chatId, `❌ Eksport xatosi: ${res.description || 'noma\'lum'}`);
    return;
  }
  const sheetsNote = isSheetsConfigured()
    ? '\n\n📊 Google Sheets ham yangilangan.'
    : '\n\n💡 Google Sheets uchun GOOGLE_SHEETS_ID va GOOGLE_SERVICE_ACCOUNT_JSON sozlang.';
  await bot.sendMessage(chatId, `✅ Excel yuborildi: <code>${filename}</code>${sheetsNote}`);
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;

  if (pendingOperatorPhone.has(chatId) && !text.startsWith('/')) {
    const phone = pendingOperatorPhone.get(chatId);
    pendingOperatorPhone.delete(chatId);
    try {
      const emp = setEmployeeOperator(phone, text);
      await bot.sendMessage(chatId, `✅ Operator: <b>${emp.operator}</b>\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (text === '/start') {
    await bot.sendMessage(chatId, [
      '<b>Uztronix</b>',
      '',
      'Xodimlar shaxsiy kabineti.',
      '',
      'Mini App ni ochish uchun quyidagi tugmani bosing.',
    ].join('\n'), { reply_markup: miniAppReplyKeyboard() });
    await bot.sendMessage(chatId, 'Yoki shu tugma orqali:', { reply_markup: miniAppInlineKeyboard() });
    if (isAdmin(fromId)) {
      await bot.sendMessage(chatId, 'Boshqaruv paneli:', adminKeyboard());
    }
    return;
  }

  if (text === '/admin' && isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Boshqaruv paneli</b>', adminKeyboard());
    return;
  }

  if (!text.startsWith('/')) return;

  if (!isAdmin(fromId)) {
    await bot.sendMessage(chatId, '⛔ Ruxsat yo\'q.');
    return;
  }

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === '/help') {
    await bot.sendMessage(chatId, helpText());
    return;
  }

  if (cmd === '/export') {
    await sendExport(bot, chatId);
    return;
  }

  if (cmd === '/list') {
    await bot.sendMessage(chatId, formatPhoneList());
    return;
  }

  if (cmd === '/employees') {
    await bot.sendMessage(chatId, formatEmployeesList());
    return;
  }

  if (cmd === '/listoperators') {
    await bot.sendMessage(chatId, formatOperatorsList());
    return;
  }

  if (cmd === '/liststages') {
    await bot.sendMessage(chatId, formatStagesList());
    return;
  }

  if (cmd === '/listadmins') {
    await bot.sendMessage(chatId, formatAdminsList());
    return;
  }

  if (cmd === '/add' && parts[1]) {
    try {
      const phone = addPhone(parts[1]);
      await bot.sendMessage(chatId, `✅ Qo\'shildi: <code>${phone}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/remove' && parts[1]) {
    try {
      const phone = removePhone(parts[1]);
      await bot.sendMessage(chatId, `✅ O\'chirildi: <code>${phone}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/addoperator' && parts[1]) {
    try {
      const name = addOperator(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, `✅ Operator qo\'shildi: <b>${name}</b>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/removeoperator' && parts[1]) {
    try {
      const name = removeOperator(parts.slice(1).join(' '));
      await bot.sendMessage(chatId, `✅ Operator o\'chirildi: <b>${name}</b>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/addstage' && parts[1]) {
    try {
      const label = parts.slice(1).join(' ');
      const stage = addStage(label);
      await bot.sendMessage(chatId, `✅ Etap qo\'shildi: <b>${stage.label}</b> (<code>${stage.id}</code>)`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/removestage' && parts[1]) {
    try {
      const id = removeStage(parts[1]);
      await bot.sendMessage(chatId, `✅ Etap o\'chirildi: <code>${id}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/addadmin' && parts[1]) {
    try {
      const id = addAdmin(parts[1]);
      await bot.sendMessage(chatId, `✅ Admin qo\'shildi: <code>${id}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/removeadmin' && parts[1]) {
    try {
      const id = removeAdmin(parts[1]);
      await bot.sendMessage(chatId, `✅ Admin o\'chirildi: <code>${id}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/employee' && parts[1]) {
    try {
      const emp = getEmployee(parts[1]);
      await bot.sendMessage(chatId, formatEmployee(emp), {
        reply_markup: {
          inline_keyboard: [[
            { text: '👔 Operator', callback_data: `pick_op:${phoneDigits(emp.phone)}` },
            { text: '📌 Etap', callback_data: `pick_st:${phoneDigits(emp.phone)}` },
          ]],
        },
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/pickoperator' && parts[1]) {
    const phone = normalizePhone(parts[1]);
    if (!phone) {
      await bot.sendMessage(chatId, '❌ Noto\'g\'ri telefon');
      return;
    }
    await bot.sendMessage(chatId, `Operator tanlang — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (cmd === '/pickstage' && parts[1]) {
    const phone = normalizePhone(parts[1]);
    if (!phone) {
      await bot.sendMessage(chatId, '❌ Noto\'g\'ri telefon');
      return;
    }
    await bot.sendMessage(chatId, `Etap tanlang — <code>${phone}</code>:`, {
      reply_markup: stagePickerKeyboard(phone),
    });
    return;
  }

  if (cmd === '/set' && parts.length >= 4) {
    const phone = parts[1];
    const field = parts[2];
    const value = parts.slice(3).join(' ');
    try {
      const emp = setEmployeeField(phone, field, value);
      await bot.sendMessage(chatId, `✅ Yangilandi\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/addcard' && parts[2]) {
    try {
      const card = addEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ Karta qo\'shildi: <code>${maskCard(card)}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/removecard' && parts[2]) {
    try {
      const card = removeEmployeeCard(parts[1], parts[2]);
      await bot.sendMessage(chatId, `✅ Karta o\'chirildi: <code>${maskCard(card)}</code>`);
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

  if (!isAdmin(fromId)) {
    await bot.answerCallbackQuery(query.id, 'Ruxsat yo\'q');
    return;
  }

  if (data === 'admin_list') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatPhoneList(), adminKeyboard());
    return;
  }

  if (data === 'admin_employees') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatEmployeesList(), adminKeyboard());
    return;
  }

  if (data === 'admin_operators') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatOperatorsList(), adminKeyboard());
    return;
  }

  if (data === 'admin_stages') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatStagesList(), adminKeyboard());
    return;
  }

  if (data === 'admin_admins') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatAdminsList(), adminKeyboard());
    return;
  }

  if (data === 'admin_export') {
    await bot.answerCallbackQuery(query.id, 'Excel tayyorlanmoqda...');
    await sendExport(bot, chatId);
    return;
  }

  if (data === 'admin_help') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, helpText(), adminKeyboard());
    return;
  }

  if (data === 'admin_add_hint') {
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, 'Telefon qo\'shish:\n<code>/add +998901234567</code>');
    return;
  }

  if (data.startsWith('pick_op:')) {
    const digits = data.slice(8);
    const phone = `+${digits}`;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Operator tanlang — <code>${phone}</code>:`, {
      reply_markup: operatorPickerKeyboard(phone),
    });
    return;
  }

  if (data.startsWith('pick_st:')) {
    const digits = data.slice(8);
    const phone = `+${digits}`;
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Etap tanlang — <code>${phone}</code>:`, {
      reply_markup: stagePickerKeyboard(phone),
    });
    return;
  }

  if (data.startsWith('op_c:')) {
    const digits = data.slice(5);
    const phone = `+${digits}`;
    pendingOperatorPhone.set(chatId, phone);
    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(chatId, `Operator ismini yuboring (<code>${phone}</code>):`);
    return;
  }

  if (data.startsWith('op:')) {
    const [, idxStr, digits] = data.split(':');
    const ops = listOperators();
    const name = ops[Number(idxStr)];
    const phone = `+${digits}`;
    if (!name) {
      await bot.answerCallbackQuery(query.id, 'Xato');
      return;
    }
    try {
      const emp = setEmployeeOperator(phone, name);
      await bot.answerCallbackQuery(query.id, `Operator: ${name}`);
      await bot.sendMessage(chatId, `✅ Yangilandi\n\n${formatEmployee(emp)}`);
    } catch (e) {
      await bot.answerCallbackQuery(query.id, e.message);
    }
    return;
  }

  if (data.startsWith('st:')) {
    const [, stageId, digits] = data.split(':');
    const phone = `+${digits}`;
    try {
      const emp = setEmployeeStage(phone, stageId);
      await bot.answerCallbackQuery(query.id, getStageLabel(stageId));
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
  let running = true;

  bot.setChatMenuButton({
    type: 'web_app',
    text: 'Shaxsiy kabinet',
    web_app: { url: webAppUrl() },
  }).then(res => {
    if (!res.ok) console.warn('Menu button setup failed:', res.description);
  }).catch(e => console.warn('Menu button setup error:', e.message));

  async function poll() {
    while (running) {
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
  console.log('Uztronix Telegram bot started');

  return () => { running = false; };
}
