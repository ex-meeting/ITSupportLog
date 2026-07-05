const STORAGE_KEY = "it-support-daily-work-logs";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby1q74q3Tb_8v7WwNdZNEQcPz3REdBfHXEuDNzb0_9OpsoRS8zjE4ppXkoRfWgyM8FlLg/exec";

const elements = {
  summaryStaff: document.querySelector("#summaryStaff"),
  summaryDate: document.querySelector("#summaryDate"),
  countAll: document.querySelector("#countAll"),
  countDone: document.querySelector("#countDone"),
  countDoing: document.querySelector("#countDoing"),
  countFailed: document.querySelector("#countFailed"),
  recentList: document.querySelector("#recentList"),
  logRows: document.querySelector("#logRows"),
  searchText: document.querySelector("#searchText"),
  filterStatus: document.querySelector("#filterStatus"),
  tableSubtitle: document.querySelector("#tableSubtitle"),
};

const params = new URLSearchParams(window.location.search);
const selectedStaff = params.get("staff") || "";
const selectedDate = params.get("date") || today();
let activeLogs = null;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoToThaiDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year + 543}`;
}

function thaiDateToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return "";

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;

  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!valid) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getLogIsoDate(log) {
  return log.work_date_iso || thaiDateToIso(log.work_date) || log.work_date;
}

function durationLabel(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return "-";
  const total = Number(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ชม. ${m} นาที`;
  if (h) return `${h} ชม.`;
  return `${m} นาที`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusClass(status) {
  return `status-pill status-${status}`;
}

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function normalizeSheetLog(log) {
  const duration = Number(log.duration_minutes);
  return {
    ...log,
    duration_minutes: Number.isFinite(duration) ? duration : null,
    attachment_names: Array.isArray(log.attachment_names)
      ? log.attachment_names
      : String(log.attachment_names || "")
          .split(";")
          .map((name) => name.trim())
          .filter(Boolean),
  };
}

async function fetchSheetLogs() {
  if (!GOOGLE_SCRIPT_URL) return null;
  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("action", "list");
  if (selectedStaff) url.searchParams.set("staff", selectedStaff);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });
  const data = await response.json();
  if (!data.ok || !Array.isArray(data.logs)) throw new Error(data.error || "Cannot load logs");
  return data.logs.map(normalizeSheetLog);
}

function allLogs() {
  return activeLogs || loadLogs();
}

function staffLogs() {
  return allLogs().filter((log) => !selectedStaff || log.staff_name === selectedStaff);
}

function filteredLogs() {
  const text = elements.searchText.value.trim().toLowerCase();
  const status = elements.filterStatus.value;

  return staffLogs()
    .filter((log) => !status || log.status === status)
    .filter((log) => {
      if (!text) return true;
      return [log.work_title, log.work_detail, log.main_category, log.sub_category, log.result_note]
        .join(" ")
        .toLowerCase()
        .includes(text);
    })
    .sort((a, b) => `${getLogIsoDate(b)} ${b.start_time}`.localeCompare(`${getLogIsoDate(a)} ${a.start_time}`));
}

function renderSummary() {
  const todayLogs = staffLogs().filter((log) => getLogIsoDate(log) === selectedDate);
  elements.summaryStaff.textContent = selectedStaff || "ไม่ระบุเจ้าหน้าที่";
  elements.summaryDate.textContent = isoToThaiDate(selectedDate);
  elements.countAll.textContent = todayLogs.length;
  elements.countDone.textContent = todayLogs.filter((log) => log.status === "สำเร็จ").length;
  elements.countDoing.textContent = todayLogs.filter((log) => log.status === "ระหว่างดำเนินการ").length;
  elements.countFailed.textContent = todayLogs.filter((log) => log.status === "ไม่สำเร็จ").length;

  const recent = todayLogs.sort((a, b) => b.start_time.localeCompare(a.start_time)).slice(0, 8);
  if (!recent.length) {
    elements.recentList.innerHTML = '<div class="empty-state">ยังไม่มีรายการของวันนี้</div>';
    return;
  }

  elements.recentList.innerHTML = recent
    .map(
      (log) => `
        <article class="recent-item">
          <div class="recent-top">
            <strong>${escapeHtml(log.work_title)}</strong>
            <span class="${statusClass(log.status)}">${escapeHtml(log.status)}</span>
          </div>
          <p>${escapeHtml(log.start_time)}${log.end_time ? `-${escapeHtml(log.end_time)}` : ""} · ${durationLabel(log.duration_minutes)}</p>
          <p>${escapeHtml(log.main_category)}</p>
        </article>
      `,
    )
    .join("");
}

function renderTable() {
  const logs = filteredLogs();
  elements.tableSubtitle.textContent = selectedStaff
    ? `แสดงเฉพาะรายการของ ${selectedStaff}`
    : "ไม่ได้ระบุเจ้าหน้าที่";

  if (!logs.length) {
    elements.logRows.innerHTML = '<tr><td colspan="6"><div class="empty-state">ไม่พบรายการตามเงื่อนไข</div></td></tr>';
    return;
  }

  elements.logRows.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(isoToThaiDate(getLogIsoDate(log)))}</td>
          <td>${escapeHtml(log.start_time)}${log.end_time ? `-${escapeHtml(log.end_time)}` : ""}<br><small>${durationLabel(log.duration_minutes)}</small></td>
          <td><strong>${escapeHtml(log.work_title)}</strong><br><small>${escapeHtml(log.work_detail).slice(0, 120)}</small></td>
          <td>${escapeHtml(log.main_category)}<br><small>${escapeHtml(log.sub_category)}</small></td>
          <td><span class="${statusClass(log.status)}">${escapeHtml(log.status)}</span></td>
          <td>${escapeHtml(log.result_note || "-")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAll() {
  renderSummary();
  renderTable();
}

elements.searchText.addEventListener("input", renderTable);
elements.filterStatus.addEventListener("change", renderTable);

async function init() {
  try {
    activeLogs = await fetchSheetLogs();
  } catch {
    activeLogs = loadLogs();
  }
  renderAll();
}

init();
