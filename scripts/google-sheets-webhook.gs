const VERIFIED_SKILLS_SHEET = 'Verified Skills';

function onVerifiedSkillEdit(event) {
  if (!event || !event.range) return;

  const sheet = event.range.getSheet();
  if (sheet.getName() !== VERIFIED_SKILLS_SHEET) return;

  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('SHEETS_WEBHOOK_URL');
  const secret = properties.getProperty('SHEETS_WEBHOOK_SECRET');
  if (!endpoint || !secret) throw new Error('Set SHEETS_WEBHOOK_URL and SHEETS_WEBHOOK_SECRET in Script Properties.');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const firstRow = Math.max(2, event.range.getRow());
  const lastRow = event.range.getRow() + event.range.getNumRows() - 1;

  for (let row = firstRow; row <= lastRow; row += 1) {
    sendVerifiedSkillRow(sheet, row, headers, endpoint, secret);
  }
}

function sendVerifiedSkillRow(sheet, row, headers, endpoint, secret) {
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const record = Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]]));
  if (!record['Record ID'] && !record['Student ID'] && !record['Skill Code']) return;

  const earnedAt = record['Date Earned'];

  const body = JSON.stringify({
    recordId: String(record['Record ID'] || '').trim(),
    studentId: String(record['Student ID'] || '').trim(),
    skillCode: String(record['Skill Code'] || '').trim(),
    earnedAt: earnedAt instanceof Date
      ? Utilities.formatDate(earnedAt, sheet.getParent().getSpreadsheetTimeZone(), 'yyyy-MM-dd')
      : String(earnedAt || '').trim(),
    status: String(record.Status || '').trim().toUpperCase(),
  });
  const timestamp = String(Date.now());
  const signature = Utilities.computeHmacSha256Signature(`${timestamp}.${body}`, secret)
    .map(byte => (byte & 0xff).toString(16).padStart(2, '0'))
    .join('');

  const response = UrlFetchApp.fetch(endpoint, {
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
  if (status >= 400) throw new Error(`Passport webhook failed with HTTP ${status} for sheet row ${row}.`);
}

function installVerifiedSkillsTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'onVerifiedSkillEdit')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('onVerifiedSkillEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
}