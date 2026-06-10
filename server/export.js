import { join } from 'path';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';
import { DATA_DIR } from './dataPath.js';
import { listEmployees } from './store.js';
import { HEADERS, rowsFromEmployees } from './exportData.js';
import { syncToGoogleSheets } from './sheets.js';

const EXPORT_FILE = join(DATA_DIR, 'uztronix_export.xlsx');

export function buildExportRows() {
  return rowsFromEmployees(listEmployees());
}

export function buildExcelBuffer() {
  const rows = buildExportRows();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = HEADERS.map((_, i) => ({ wch: i === 0 ? 18 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Сотрудники');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function saveExcelToDisk() {
  const buf = buildExcelBuffer();
  writeFileSync(EXPORT_FILE, buf);
  return EXPORT_FILE;
}

let syncTimer = null;

export function scheduleDataSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      saveExcelToDisk();
      await syncToGoogleSheets();
    } catch (e) {
      console.error('Data sync error:', e.message);
    }
  }, 1500);
}

export function getExportFilename() {
  const d = new Date().toISOString().slice(0, 10);
  return `uztronix_${d}.xlsx`;
}
