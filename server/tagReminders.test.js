import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('tag reminders detect inactivity, use quiet hours, snooze, and ignore', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-reminder-test-'));
  process.env.DATA_DIR = dataDir;
  const reminders = await import('./tagReminders.js');
  const anchor = Date.parse('2026-08-08T10:00:00.000Z');
  const employee = {
    phone: '+998901234567',
    clientId: '7',
    fullName: 'Test Client',
    operator: 'Operator',
    createdBy: 777,
    createdAt: new Date(anchor).toISOString(),
    tags: [],
    tagHistory: [
      { action: 'remove', at: '2026-08-08T11:00:00.000Z' },
    ],
  };
  const sent = [];
  const bot = {
    sendMessage: async (...args) => {
      sent.push(args);
      return { ok: true };
    },
  };

  try {
    assert.equal(reminders.tagActivityAnchor(employee), anchor);
    assert.equal(reminders.isMoscowQuiet(new Date('2026-08-08T02:00:00.000Z')), true);
    assert.equal(reminders.isMoscowQuiet(new Date('2026-08-08T10:00:00.000Z')), false);

    const now = Date.parse('2026-08-08T12:01:00.000Z');
    const result = await reminders.runTagReminderScan(bot, { now, employees: [employee] });
    assert.deepEqual(result, { checked: 1, notified: 1 });
    assert.equal(sent[0][0], 777);
    assert.equal(sent[0][2].disable_notification, false);
    assert.equal(sent[0][2].reply_markup.inline_keyboard.length, 3);

    const snoozed = reminders.snoozeTagReminder(employee.phone, 4, now);
    assert.equal(snoozed.snoozedUntil, '2026-08-08T16:01:00.000Z');
    assert.equal(reminders.ignoreTagReminder(employee.phone).ignored, true);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
