import { join } from 'path';
import { getDataDir, readJson, writeJson } from './dataPath.js';

function counterFile() {
  return join(getDataDir(), 'client_counter.json');
}

export function nextClientId() {
  const data = readJson(counterFile(), { next: 1 });
  const id = String(data.next);
  data.next += 1;
  writeJson(counterFile(), data);
  return id;
}

export function normalizeClientId(raw) {
  const q = String(raw || '').trim();
  if (/^\d+$/.test(q)) return q;
  if (/^CLT-0*(\d+)$/i.test(q)) return q.replace(/^CLT-0*/i, '').replace(/^0+/, '') || '0';
  return q;
}

export function assignClientIdIfMissing(emp) {
  if (!emp.clientId) {
    emp.clientId = nextClientId();
  } else if (String(emp.clientId).startsWith('CLT-')) {
    emp.clientId = normalizeClientId(emp.clientId);
  }
  return emp.clientId;
}
