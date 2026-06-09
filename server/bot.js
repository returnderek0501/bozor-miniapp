import {
  listPhones, addPhone, removePhone,
  getEmployee, setEmployeeField, listEmployees,
  addEmployeeCard, removeEmployeeCard, maskCard,
} from './store.js';
import { createBotApi } from './telegram.js';

const ADMIN_IDS = (process.env.ADMIN_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(Number);

function isAdmin(id) {
  return ADMIN_IDS.length === 0 || ADMIN_IDS.includes(Number(id));
}

function adminKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Telefonlar', callback_data: 'admin_list' },
          { text: '👤 Xodimlar', callback_data: 'admin_employees' },
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
    '<b>Telefonlar:</b>',
    '/add &lt;raqam&gt; — kirish ruxsati',
    '/remove &lt;raqam&gt; — o\'chirish',
    '/list — telefonlar ro\'yxati',
    '',
    '<b>Xodim profili:</b>',
    '/set &lt;telefon&gt; &lt;maydon&gt; &lt;qiymat&gt;',
    '  maydonlar: name, position, dept, tenure, balance, id',
    '/employee &lt;telefon&gt; — profilni ko\'rish',
    '',
    '<b>Kartalar (chiqarish):</b>',
    '/addcard &lt;telefon&gt; &lt;karta&gt;',
    '/removecard &lt;telefon&gt; &lt;karta&gt;',
    '',
    '<i>Misollar:</i>',
    '<code>/set +998901234567 name Alisher Karimov</code>',
    '<code>/set +998901234567 balance 2500000</code>',
    '<code>/set +998901234567 tenure 3 yil 6 oy</code>',
    '<code>/addcard +998901234567 8600123456789012</code>',
  ].join('\n');
}

function formatPhoneList() {
  const phones = listPhones();
  if (!phones.length) return 'Telefonlar ro\'yxati bo\'sh.';
  return [
    `<b>Telefonlar (${phones.length})</b>`,
    '',
    ...phones.map(p => `• <code>${p}</code>`),
  ].join('\n');
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
      `• <code>${e.phone}</code> — ${e.fullName || '—'} (${formatMoney(e.advanceBalance)} so\'m)`,
    ),
  ].join('\n');
}

function formatMoney(n) {
  return Number(n || 0).toLocaleString('uz-UZ');
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;

  if (text === '/start') {
    await bot.sendMessage(chatId, [
      '<b>Uztronix Holding</b>',
      '',
      'Xodimlar shaxsiy kabineti — Telegram Mini App.',
      '',
      'Kirish uchun telefon raqamingizni tasdiqlang.',
    ].join('\n'), {
      reply_markup: {
        inline_keyboard: [[
          { text: '📱 Shaxsiy kabinet', web_app: { url: process.env.WEBAPP_URL || 'https://bozor-miniapp-production.up.railway.app' } },
        ]],
      },
    });
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

  if (cmd === '/list') {
    await bot.sendMessage(chatId, formatPhoneList());
    return;
  }

  if (cmd === '/employees') {
    await bot.sendMessage(chatId, formatEmployeesList());
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

  if (cmd === '/employee' && parts[1]) {
    try {
      const emp = getEmployee(parts[1]);
      await bot.sendMessage(chatId, formatEmployee(emp));
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
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
  const data = query.data;

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

  await bot.answerCallbackQuery(query.id);
}

export function startBot(token) {
  const bot = createBotApi(token);
  let offset = 0;
  let running = true;

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
