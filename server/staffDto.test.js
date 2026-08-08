import test from 'node:test';
import assert from 'node:assert/strict';
import { staffClientSummary } from './staffDto.js';

test('staff client summary exposes the latest activity timestamp', () => {
  const summary = staffClientSummary({
    clientId: '42',
    phone: '+998901234567',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-04T12:30:00.000Z',
    tags: [{ id: 'pasport', label: 'Паспорт получен' }],
  });

  assert.equal(summary.updatedAt, '2026-08-04T12:30:00.000Z');
  assert.deepEqual(summary.tags, [{ id: 'pasport', label: 'Паспорт получен' }]);
  assert.equal(summary.telegramLinked, false);
  assert.equal(summary.telegramId, null);
});

test('staff client summary falls back to creation time for legacy clients', () => {
  const summary = staffClientSummary({
    clientId: '43',
    phone: '+998901234568',
    createdAt: '2026-08-01T08:00:00.000Z',
  });

  assert.equal(summary.updatedAt, '2026-08-01T08:00:00.000Z');
});
