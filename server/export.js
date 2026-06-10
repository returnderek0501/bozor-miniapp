import { join } from 'path';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';
import { DATA_DIR } from './dataPath.js';
import { listEmployees } from './store.js';
import {
  HEADERS_MAIN,
  HEADERS_TAG_HISTORY,
  HEADERS_PHOTOS,
  rowsFromEmployees,
  tagHistoryRows,
  photoRows,
  groupByOperator,
  sanitizeSheetName,
} from './exportData.js';
import { syncToGoogleSheets } from './sheets.js';

const EXPORT_FILE = join(DATA_DIR, 'uztronix_export.xlsx');

export function buildWorkbookData() {
  const employees = listEmployees();
  const sheets = [
    { name: 'Все лиды', headers: HEADERS_MAIN, rows: rowsFromEmployees(employees) },
    { name: 'История тегов', headers: HEADERS_TAG_HISTORY, rows: tagHistoryRows(employees) },
    { name: 'Фото', headers: HEADERS_PHOTOS, rows: photoRows(employees) },
  ];

  for (const [operator, emps] of groupByOperator(employees)) {
    sheets.push({
      name: sanitizeSheetName(operator),
      headers: HEADERS_MAIN,
      rows: rowsFromEmployees(emps),
    });
  }

  return sheets;
}

export function buildExcelBuffer() {
  const sheets = buildWorkbookData();
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    ws['!cols'] = sheet.headers.map((_, i) => ({ wch: i === 0 ? 18 : 16 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

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
  return `uztronix_${new Date().toISOString().slice(0, 10)}.xlsx`;
}
