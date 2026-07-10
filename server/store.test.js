import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('updateEmployeeFields validates all values before writing', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-store-test-'));
  process.env.DATA_DIR = dataDir;
  const store = await import('./store.js');

  try {
    const phone = store.addPhone('+998901234567');
    store.updateEmployeeFields(phone, {
      name: 'Original Name',
      age: 30,
      balance: 1000,
    });

    assert.throws(() => store.updateEmployeeFields(phone, {
      name: 'Should Not Persist',
      age: 0,
    }), /1–120/);

    const employee = store.getEmployee(phone);
    assert.equal(employee.fullName, 'Original Name');
    assert.equal(employee.age, 30);
    assert.equal(employee.advanceBalance, 1000);
    assert.throws(
      () => store.updateEmployeeFields(phone, { balance: -1 }),
      /отрицательным/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
