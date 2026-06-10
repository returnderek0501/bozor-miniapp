import { google } from 'googleapis';
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

let sheetsClient = null;

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON parse error');
    return null;
  }
}

function getSheetsApi() {
  if (sheetsClient) return sheetsClient;
  const credentials = getCredentials();
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!credentials || !sheetId) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export function isSheetsConfigured() {
  return !!(process.env.GOOGLE_SHEETS_ID && getCredentials());
}

async function ensureSheet(spreadsheetId, title) {
  const sheets = getSheetsApi();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some(s => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

async function writeSheet(spreadsheetId, title, headers, rows) {
  await ensureSheet(spreadsheetId, title);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  });
}

export async function syncToGoogleSheets() {
  const sheets = getSheetsApi();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheets || !spreadsheetId) return { ok: false, reason: 'not_configured' };

  const employees = listEmployees();

  await writeSheet(spreadsheetId, 'Все лиды', HEADERS_MAIN, rowsFromEmployees(employees));
  await writeSheet(spreadsheetId, 'История тегов', HEADERS_TAG_HISTORY, tagHistoryRows(employees));
  await writeSheet(spreadsheetId, 'Фото', HEADERS_PHOTOS, photoRows(employees));

  for (const [operator, emps] of groupByOperator(employees)) {
    await writeSheet(
      spreadsheetId,
      sanitizeSheetName(operator),
      HEADERS_MAIN,
      rowsFromEmployees(emps),
    );
  }

  return { ok: true, rows: employees.length };
}
