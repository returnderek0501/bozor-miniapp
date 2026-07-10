import { getTelegramIdByPhone } from './store.js';
import { listOperators } from './operators.js';
import { listAdmins } from './admins.js';
import {
  formatBroadcastApproval, markBroadcastSent, resolveBroadcastRecipients,
} from './broadcasts.js';

let botRef = null;

export function setStaffMessagingBot(bot) {
  botRef = bot;
}

function requireBot() {
  if (!botRef) throw new Error('BOT_UNAVAILABLE');
  return botRef;
}

export async function sendClientMessage(phone, text) {
  const telegramId = getTelegramIdByPhone(phone);
  if (!telegramId) throw new Error('CLIENT_NOT_LINKED');
  const result = await requireBot().sendMessage(telegramId, text);
  if (!result?.ok) throw new Error(result?.description || 'MESSAGE_SEND_FAILED');
  return { sent: 1, failed: 0, total: 1 };
}

export async function executeBroadcast(broadcast, creatorTelegramId) {
  const bot = requireBot();
  const ids = resolveBroadcastRecipients(broadcast, creatorTelegramId);
  let sent = 0;
  let failed = 0;
  for (const telegramId of ids) {
    const result = await bot.sendMessage(telegramId, broadcast.text);
    if (result?.ok) sent += 1;
    else failed += 1;
  }
  if (broadcast.id) markBroadcastSent(broadcast.id);
  return { sent, failed, total: ids.length };
}

export async function notifyBroadcastApprovers(broadcast) {
  const bot = requireBot();
  const notified = new Set();
  const targets = [
    ...listOperators().map(operator => operator.telegramId).filter(Boolean),
    ...listAdmins(),
  ];
  for (const telegramId of targets) {
    if (notified.has(telegramId)) continue;
    notified.add(telegramId);
    await bot.sendMessage(telegramId, formatBroadcastApproval(broadcast), {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `bc_ok:${broadcast.id}` },
        ]],
      },
    });
  }
}
