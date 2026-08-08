import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStatsRange, staffStatsData } from './stats.js';

const NOW = Date.parse('2026-08-08T12:00:00.000Z');

const employees = [
  {
    operator: 'Анна',
    createdAt: '2026-08-08T11:30:00.000Z',
    tagHistory: [
      { label: 'В работе', action: 'add', at: '2026-08-08T11:40:00.000Z', byName: 'Анна' },
      { label: 'В работе', action: 'remove', at: '2026-08-08T11:50:00.000Z', byName: 'Анна' },
    ],
  },
  {
    operator: 'Борис',
    createdAt: '2026-08-05T12:00:00.000Z',
    tagHistory: [
      { label: 'Договор', action: 'add', at: '2026-08-06T12:00:00.000Z', byName: 'Борис' },
    ],
  },
];

test('stats ranges use rolling windows and Moscow calendar day', () => {
  assert.equal(resolveStatsRange('hour', NOW).since, '2026-08-08T11:00:00.000Z');
  assert.equal(resolveStatsRange('today', NOW).since, '2026-08-07T21:00:00.000Z');
  assert.equal(resolveStatsRange('invalid', NOW).range, 'today');
});

test('staff stats count tag events by acting operator in selected range', () => {
  const hour = staffStatsData('hour', employees, NOW);
  assert.deepEqual(hour.totals, {
    clients: 2,
    clientsCreated: 1,
    tagAssignments: 1,
    tagRemovals: 1,
  });
  assert.equal(hour.operators.find(row => row.name === 'Анна').tags['В работе'], 1);

  const week = staffStatsData('week', employees, NOW);
  assert.equal(week.totals.clientsCreated, 2);
  assert.equal(week.totals.tagAssignments, 2);
  assert.equal(week.operators.find(row => row.name === 'Борис').tags.Договор, 1);
});
