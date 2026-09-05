import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('komsa-4 toggle blocks card withdraw and stores incassation orders', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'uztronix-komsa4-'));
  process.env.DATA_DIR = dataDir;
  const store = await import(`./store.js?komsa4=${Date.now()}`);

  try {
    const phone = store.addPhone('+998901112233');
    store.updateEmployeeFields(phone, { name: 'Test Client', balance: 500000 });

    let emp = store.getEmployee(phone);
    assert.equal(emp.komsa4Enabled, false);
    assert.equal(emp.incassationOrder, null);

    emp = store.setKomsa4Enabled(phone, true);
    assert.equal(emp.komsa4Enabled, true);

    assert.throws(
      () => store.withdrawAdvance(phone, '8600123456789012', 1000),
      /KOMSA4_CARD_UNAVAILABLE/,
    );
    assert.equal(store.getEmployee(phone).advanceBalance, 500000);

    emp = store.saveIncassationOrder(phone, {
      address: 'Toshkent, Yunusobod 12',
      fullName: 'Ali Valiyev',
      contactPhone: '+998901112233',
    });
    assert.equal(emp.incassationOrder.status, 'requested');
    assert.equal(emp.incassationOrder.fullName, 'Ali Valiyev');
    assert.match(emp.incassationOrder.address, /Yunusobod/);

    emp = store.declineIncassation(phone);
    assert.equal(emp.incassationOrder.status, 'declined');

    emp = store.setKomsa4Enabled(phone, false);
    assert.equal(emp.komsa4Enabled, false);
    assert.throws(
      () => store.saveIncassationOrder(phone, {
        address: 'Toshkent, Yunusobod 12',
        fullName: 'Ali Valiyev',
        contactPhone: '+998901112233',
      }),
      /KOMSA4_DISABLED/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
});
