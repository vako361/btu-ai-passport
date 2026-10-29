const CONFIG = {
  SHEET_NAME: 'Passport Skill Records',
  HEADER_ROW: 4,
  URL_PROPERTY: 'SHEETS_WEBHOOK_URL',
  SECRET_PROPERTY: 'SHEETS_WEBHOOK_SECRET',
};

const COLUMNS = {
  RECORD_ID: ['Record ID'],
  STUDENT_ID: ['Student ID'],
  FIRST_NAME: ['First Name'],
  LAST_NAME: ['Last Name'],
  EMAIL: ['BTU Email (Test)', 'Email'],
  SKILL_CODE: ['Skill ID', 'Skill Code'],
  SKILL_NAME: ['Skill Name'],
  BADGE_ID: ['Badge/Stamp Code'],
  DATE_EARNED: ['Date Earned'],
  STATUS: ['Passport Sync Status'],
  SYNCED_AT: ['Synced At (UTC)'],
};

const REQUIRED_COLUMNS = ['RECORD_ID', 'STUDENT_ID', 'SKILL_CODE', 'SKILL_NAME', 'BADGE_ID', 'DATE_EARNED', 'STATUS', 'SYNCED_AT'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Passport Sync')
    .addItem('Sync New Skills', 'syncSkillsToPassportSystem')
    .addToUi();
}

function syncSkillsToPassportSystem() {
  const sheet = getPassportSheet();
  const webhook = getWebhookConfig();
  const columns = getColumns(sheet);
  const lastRow = sheet.getLastRow();
  let sentCount = 0;
  let failedCount = 0;

  for (let row = CONFIG.HEADER_ROW + 1; row <= lastRow; row += 1) {
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (String(rowData[columns.STATUS] || '').trim().toUpperCase() !== 'SYNCED') continue;
    if (hasSuccessfulSyncMarker(rowData[columns.SYNCED_AT])) continue;

    const result = sendVerifiedSkillRow(sheet, row, rowData, columns, webhook);
    if (result.success) sentCount += 1;
    else failedCount += 1;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(`${sentCount} synced, ${failedCount} failed.`);
}

function installEditTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'onEditTrigger')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
}

function onEditTrigger(event) {
  if (!event || !event.range) return;
  const sheet = event.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME || event.range.getLastRow() <= CONFIG.HEADER_ROW) return;

  const webhook = getWebhookConfig();
  const columns = getColumns(sheet);
  const statusColumn = columns.STATUS + 1;
  if (statusColumn < event.range.getColumn() || statusColumn > event.range.getLastColumn()) return;

  const firstRow = Math.max(CONFIG.HEADER_ROW + 1, event.range.getRow());
  for (let row = firstRow; row <= event.range.getLastRow(); row += 1) {
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (String(rowData[columns.STATUS] || '').trim().toUpperCase() !== 'SYNCED') continue;
    if (hasSuccessfulSyncMarker(rowData[columns.SYNCED_AT])) continue;
    sendVerifiedSkillRow(sheet, row, rowData, columns, webhook);
  }
}

function getPassportSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${CONFIG.SHEET_NAME}" was not found.`);
  return sheet;
}

function getWebhookConfig() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty(CONFIG.URL_PROPERTY);
  const secret = properties.getProperty(CONFIG.SECRET_PROPERTY);
  if (!endpoint || !secret || secret.length < 32) {
    throw new Error('Set SHEETS_WEBHOOK_URL and a 32+ character SHEETS_WEBHOOK_SECRET in Script Properties.');
  }
  return { endpoint, secret };
}

function getColumns(sheet) {
  const headers = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(header => header.trim());
  const indexes = {};

  Object.keys(COLUMNS).forEach(key => {
    indexes[key] = headers.findIndex(header => COLUMNS[key].includes(header));
  });

  const missing = REQUIRED_COLUMNS.filter(key => indexes[key] < 0);
  if (missing.length) {
    throw new Error(`Missing required sheet columns: ${missing.map(key => COLUMNS[key][0]).join(', ')}`);
  }
  return indexes;
}

function hasSuccessfulSyncMarker(value) {
  if (value === '' || value === null || value === undefined) return false;
  return !String(value).trim().toUpperCase().startsWith('ERROR:');
}

function formatEarnedDate(value, sheet) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, sheet.getParent().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  const date = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  throw new Error(`Invalid Date Earned value: ${date || '(empty)'}`);
}

function sendVerifiedSkillRow(sheet, row, rowData, columns, webhook) {
  const value = key => columns[key] < 0 ? '' : String(rowData[columns[key]] || '').trim();
  const recordId = value('RECORD_ID');
  const studentId = value('STUDENT_ID');
  const skillCode = value('SKILL_CODE');

  let result;
  try {
    if (!recordId || !studentId || !skillCode) {
      throw new Error('Record ID, Student ID, and Skill ID are required.');
    }
    const payload = {
      recordId,
      studentId,
      firstName: value('FIRST_NAME'),
      lastName: value('LAST_NAME'),
      email: value('EMAIL'),
      skillCode,
      badgeId: value('BADGE_ID'),
      skillName: value('SKILL_NAME'),
      earnedAt: formatEarnedDate(rowData[columns.DATE_EARNED], sheet),
      status: 'CONFIRMED',
    };
    console.log('Sending payload:', JSON.stringify(payload));
    result = postSignedPayload(payload, webhook);
  } catch (error) {
    result = { success: false, message: error instanceof Error ? error.message : String(error) };
  }

  const marker = result.success ? new Date() : `ERROR: ${result.message}`;
  sheet.getRange(row, columns.SYNCED_AT + 1).setValue(marker);
  if (!result.success) console.error(`Row ${row} failed: ${result.message}`);
  return result;
}

function postSignedPayload(payload, webhook) {
  const body = JSON.stringify(payload);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const timestamp = String(Date.now());
    const signature = Utilities.computeHmacSha256Signature(`${timestamp}.${body}`, webhook.secret)
      .map(byte => (byte & 0xff).toString(16).padStart(2, '0'))
      .join('');

    try {
      const response = UrlFetchApp.fetch(webhook.endpoint, {
        method: 'post',
        contentType: 'application/json',
        payload: body,
        headers: {
          'X-Sheets-Timestamp': timestamp,
          'X-Sheets-Signature': `sha256=${signature}`,
        },
        muteHttpExceptions: true,
      });
      const status = response.getResponseCode();
      const responseBody = response.getContentText();
      if (status >= 200 && status < 300) return { success: true, message: responseBody };
      if (status !== 503 || attempt === 2) {
        return { success: false, message: `HTTP ${status}: ${responseBody.slice(0, 500)}` };
      }
    } catch (error) {
      if (attempt === 2) return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
    Utilities.sleep(500 * (attempt + 1));
  }
  return { success: false, message: 'Webhook retry limit reached.' };
}