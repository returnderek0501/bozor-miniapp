import {
  getUser, setUserField, addNotification, listUsers,
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

function helpText() {
  return [
    '<b>Admin buyruqlar</b>',
    '',
    '/user &lt;id&gt; — profilni ko\'rish',
    '/set &lt;id&gt; &lt;field&gt; &lt;value&gt;',
    '  field: name, balance, change, signals, success, since, level, lang',
    '/notify &lt;id&gt; &lt;sarlavha&gt; | &lt;matn&gt;',
    '/users — barcha foydalanuvchilar',
    '',
    '<i>Misol:</i>',
    '/set 123456789 name Alisher Karimov',
    '/set 123456789 balance 50000',
    '/notify 123456789 🚨 Signal! | BTC sotib oling',
  ].join('\n');
}

async function handleCommand(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const fromId = msg.from.id;

  if (text === '/start') {
    await bot.sendMessage(chatId,
      '👋 <b>Bozor</b> demo bot\n\nMini App orqali investitsiya signallarini ko\'ring.',
    );
    if (isAdmin(fromId)) {
      await bot.sendMessage(chatId, helpText());
    }
    return;
  }

  if (!text.startsWith('/')) return;
  if (!isAdmin(fromId)) {
    await bot.sendMessage(chatId, '⛔ Admin huquqi yo\'q.');
    return;
  }

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  if (cmd === '/help') {
    await bot.sendMessage(chatId, helpText());
    return;
  }

  if (cmd === '/users') {
    const users = listUsers();
    const lines = Object.values(users).map(u =>
      `• <code>${u.telegramId}</code> — ${u.displayName} ($${u.balance})`,
    );
    await bot.sendMessage(chatId, lines.length ? lines.join('\n') : 'Foydalanuvchilar yo\'q.');
    return;
  }

  if (cmd === '/user' && parts[1]) {
    const user = getUser(parts[1]);
    await bot.sendMessage(chatId, formatUser(user));
    return;
  }

  if (cmd === '/set' && parts.length >= 4) {
    const id = parts[1];
    const fieldMap = {
      name: 'displayName',
      balance: 'balance',
      change: 'balanceChangePct',
      signals: 'totalSignals',
      success: 'successRate',
      since: 'memberSince',
      level: 'level',
      lang: 'language',
      signalids: 'signalIds',
    };
    const rawField = parts[2].toLowerCase();
    const field = fieldMap[rawField];
    if (!field) {
      await bot.sendMessage(chatId, `Noma\'lum field: ${parts[2]}`);
      return;
    }
    const value = parts.slice(3).join(' ');
    try {
      const user = setUserField(id, field, value);
      await bot.sendMessage(chatId, `✅ Yangilandi\n\n${formatUser(user)}`);
    } catch (e) {
      await bot.sendMessage(chatId, `❌ ${e.message}`);
    }
    return;
  }

  if (cmd === '/notify' && parts[1]) {
    const id = parts[1];
    const rest = text.slice(text.indexOf(parts[1]) + parts[1].length).trim();
    const [title, body] = rest.split('|').map(s => s.trim());
    if (!title || !body) {
      await bot.sendMessage(chatId, 'Format: /notify &lt;id&gt; &lt;sarlavha&gt; | &lt;matn&gt;');
      return;
    }
    const notif = addNotification(id, { title, body, type: 'info' });
    await bot.sendMessage(id, `<b>${title}</b>\n\n${body}`);
    await bot.sendMessage(chatId, `✅ Bildirishnoma yuborildi (id: ${notif.id})`);
    return;
  }

  await bot.sendMessage(chatId, 'Noma\'lum buyruq. /help');
}

function formatUser(u) {
  return [
    `<b>${u.displayName}</b>`,
    `ID: <code>${u.telegramId}</code>`,
    `Balans: $${u.balance} (+${u.balanceChangePct}%)`,
    `Signallar: ${u.totalSignals} | Muvaffaqiyat: ${u.successRate}%`,
    `Daraja: ${u.level} | ${u.memberSince} dan`,
    `Til: ${u.language}`,
  ].join('\n');
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
          }
        }
      } catch (e) {
        console.error('Bot poll error:', e.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  poll();
  console.log('Telegram bot started (long polling)');

  return () => { running = false; };
}
