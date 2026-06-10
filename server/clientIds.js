import { join } from 'path';
import { DATA_DIR, readJson, writeJson } from './dataPath.js';

const COUNTER_FILE = join(DATA_DIR, 'client_counter.json');

export function nextClientId() {
  const data = readJson(COUNTER_FILE, { next: 1 });
  const id = `CLT-${String(data.next).padStart(6, '0')}`;
  data.next += 1;
  writeJson(COUNTER_FILE, data);
  return id;
}

export function assignClientIdIfMissing(emp) {
  if (!emp.clientId) {
    emp.clientId = nextClientId();
  }
  return emp.clientId;
}
