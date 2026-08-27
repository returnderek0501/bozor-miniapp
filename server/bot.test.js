import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleCommand, matchesExpectedBotUsername, miniAppLaunchKeyboard,
  START_MESSAGE, MINI_APP_BUTTON_TEXT,
} from './bot.js';

test('/start sends a Mini App launch button', async () => {
  const messages = [];
  const bot = {
    sendMessage: async (...args) => {
      messages.push(args);
      return { ok: true };
    },
  };

  const previousUrl = process.env.WEBAPP_URL;
  process.env.WEBAPP_URL = 'https://mini-app.example.com';
  try {
    await handleCommand(bot, {
      chat: { id: 100 },
      from: { id: 200 },
      text: '/start',
    });
  } finally {
    if (previousUrl === undefined) delete process.env.WEBAPP_URL;
    else process.env.WEBAPP_URL = previousUrl;
  }

  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], 100);
  assert.equal(messages[0][1], START_MESSAGE);
  assert.match(messages[0][1], /Ilovani ochish uchun quyidagi tugmani bosing/);
  assert.doesNotMatch(messages[0][1], /[А-Яа-яЁё]/);
  assert.equal(MINI_APP_BUTTON_TEXT, '🚀 Mini Appni ochish');
  assert.deepEqual(messages[0][2], miniAppLaunchKeyboard('https://mini-app.example.com'));
  assert.equal(messages[0][2].reply_markup.inline_keyboard[0][0].web_app.url, 'https://mini-app.example.com');
});

test('/старт also sends a Mini App launch button', async () => {
  const messages = [];
  const bot = {
    sendMessage: async (...args) => {
      messages.push(args);
      return { ok: true };
    },
  };

  await handleCommand(bot, {
    chat: { id: 101 },
    from: { id: 201 },
    text: '/старт',
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0][0], 101);
  assert.equal(messages[0][1], START_MESSAGE);
  assert.deepEqual(messages[0][2], miniAppLaunchKeyboard());
});

test('bot identity guard accepts only the configured username', () => {
  const botInfo = { id: 123, username: 'UztronixBot' };

  assert.equal(matchesExpectedBotUsername(botInfo, ''), true);
  assert.equal(matchesExpectedBotUsername(botInfo, '@uztronixbot'), true);
  assert.equal(matchesExpectedBotUsername(botInfo, 'OTHER_BOT'), false);
});
