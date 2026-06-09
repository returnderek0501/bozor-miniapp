import {
  listPhones, addPhone, removePhone, normalizePhone,
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
          { text: '📋 Ro\'yxat', callback_data: 'admin_list' },
          { text: '➕ Qo\'shish', callback_data: 'admin_add_hint' },
        ],
        [
          { text: '➖ O\'chirish', callback_data: 'admin_remove_hint' },
          { text: 'ℹ️ Yordam', callback_data: 'admin_help' },
        ],
      ],
    },
  };
}

function helpText() {
  return [
    '<b>Uztronix — admin paneli</b>',
    '',
    'Foydalanuvchilar faqat ruxsat etilgan telefon raqamlari orqali Mini App ga kirishi mumkin.',
    '',
    '<b>Buyruqlar:</b>',
    '/admin — boshqaruv paneli',
    '/add &lt;raqam&gt; — raqam qo\'shish',
    '/remove &lt;raqam&gt; — raqamni o\'chirish',
    '/list — ruxsat etilgan raqamlar',
    '',
    '<i>Misol:</i> <code>/add +998901234567</code>',
  ].join('\n');
}

function formatPhoneList() {
  const phones = listPhones();
  if (!phones.length) return 'Ruxsat etilgan raqamlar ro\'yxati bo\'sh.';
  return [
    `<b>Ruxsat etilgan raqamlar (${phones.length})</b>`,
    '',
    ...phones.map(p => `• <code>${p}</code>`),
  ].join('\n');
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;

  if (text === '/start') {
    await bot.sendMessage(chatId, [
      '<b>Uztronix Holding</b>',
      '',
      'Rasmiy Telegram Mini App — xizmatlar va ma\'lumotlar portali.',
      '',
      'Kirish uchun Mini App tugmasidan foydalaning. Tizimga faqat ro\'yxatdan o\'tgan telefon raqamlari orqali kirish mumkin.',
    ].join('\n'), {
      reply_markup: {
        inline_keyboard: [[
          { text: '📱 Mini App ochish', web_app: { url: process.env.WEBAPP_URL || 'https://uztronix-miniapp.up.railway.app' } },
        ]],
      },
    });
    if (isAdmin(fromId)) {
      await bot.sendMessage(chatId, 'Siz admin sifatida tizimga ulangansiz.', adminKeyboard());
    }
    return;
  }

  if (text === '/admin' && isAdmin(fromId)) {
    await bot.sendMessage(chatId, '<b>Admin paneli</b>\n\nTelefon raqamlarini boshqaring:', adminKeyboard());
    return;
  }

  if (!text.startsWith('/')) return;

  if (!isAdmin(fromId)) {
    await bot.sendMessage(chatId, '⛔ Ushbu buyruq faqat administratorlar uchun.');
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

  if (cmd === '/add' && parts[1]) {
    try {
      const phone = addPhone(parts[1], fromId);
      await bot.sendMessage(chatId, `✅ Raqam qo\'shildi: <code>${phone}</code>`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/remove' && parts[1]) {
    try {
      const phone = removePhone(parts[1]);
      await bot.sendMessage(chatId, `✅ Raqam o\'chirildi: <code>${phone}</code>`);
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
    await bot.answerCallbackQuery(query.id, 'Admin huquqi yo\'q');
    return;
  }

  if (data === 'admin_list') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, formatPhoneList(), adminKeyboard());
    return;
  }

  if (data === 'admin_help') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(chatId, messageId, helpText(), adminKeyboard());
    return;
  }

  if (data === 'admin_add_hint') {
    await bot.answerCallbackQuery(query.id, 'Raqam qo\'shish: /add +998901234567');
    await bot.sendMessage(chatId, 'Raqam qo\'shish uchun yuboring:\n<code>/add +998901234567</code>');
    return;
  }

  if (data === 'admin_remove_hint') {
    await bot.answerCallbackQuery(query.id, 'Raqam o\'chirish: /remove +998901234567');
    await bot.sendMessage(chatId, 'Raqam o\'chirish uchun yuboring:\n<code>/remove +998901234567</code>');
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
