const SHEET_NAME = "work_logs";

const HEADERS = [
  "log_id",
  "work_date",
  "staff_name",
  "staff_email",
  "start_time",
  "end_time",
  "duration_minutes",
  "main_category",
  "sub_category",
  "work_title",
  "work_detail",
  "status",
  "result_note",
  "attachment_names",
  "created_at",
  "updated_at",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`Sheet not found: ${SHEET_NAME}`);
    }

    const now = new Date();
    const row = HEADERS.map((header) => {
      const value = payload[header];
      if (Array.isArray(value)) return value.join("; ");
      if (header === "updated_at") return value || now.toISOString();
      if (header === "created_at") return value || now.toISOString();
      return value ?? "";
    });

    const rowIndex = findRowByLogId_(sheet, payload.log_id);
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return jsonResponse({
      ok: true,
      log_id: payload.log_id,
      row: rowIndex > 0 ? rowIndex : sheet.getLastRow(),
      action: rowIndex > 0 ? "updated" : "inserted",
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message,
    });
  }
}

function findRowByLogId_(sheet, logId) {
  if (!logId) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (values[i][0] === logId) return i + 2;
  }
  return -1;
}

function doGet() {
  return jsonResponse({
    ok: true,
    service: "IT Support Daily Work Logs",
    target_sheet: SHEET_NAME,
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
