import { google } from 'googleapis';
import { listEmployees } from './store.js';
import { HEADERS, rowsFromEmployees } from './exportData.js';

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

export async function syncToGoogleSheets() {
  const sheets = getSheetsApi();
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!sheets || !sheetId) return { ok: false, reason: 'not_configured' };

  const sheetName = process.env.GOOGLE_SHEETS_TAB || 'Сотрудники';
  const values = [HEADERS, ...rowsFromEmployees(listEmployees())];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  return { ok: true, rows: values.length - 1 };
}
