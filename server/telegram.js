import crypto from 'crypto';

export function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash !== hash) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

export function createBotApi(token) {
  const base = `https://api.telegram.org/bot${token}`;

  async function call(method, body = {}) {
    const res = await fetch(`${base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  return {
    sendMessage: (chatId, text, extra = {}) =>
      call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra }),

    answerCallbackQuery: (callbackQueryId, text) =>
      call('answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: !!text }),

    editMessageText: (chatId, messageId, text, extra = {}) =>
      call('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', ...extra }),

    getUpdates: async (offset) => {
      const res = await fetch(`${base}/getUpdates?timeout=30&offset=${offset || 0}`);
      return res.json();
    },

    setChatMenuButton: (menuButton) =>
      call('setChatMenuButton', { menu_button: menuButton }),

    sendDocument: async (chatId, buffer, filename) => {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('document', new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }), filename);
      const res = await fetch(`${base}/sendDocument`, { method: 'POST', body: form });
      return res.json();
    },
  };
}
