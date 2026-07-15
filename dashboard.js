const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHp434IfxY6I6aa2RVXcn4McRGKojBsZRvNx40N5qyIZP3aJrwYUriYtZNtSXGKEPTEA/exec";
const MANAGER_TOKEN = "MANAGER_TOKEN_20260706_B7N5Q2";

const STATUS_LABELS = ["สำเร็จ", "ไม่สำเร็จ", "ต่อเนื่องในครั้งถัดไป", "ยกเลิก"];
const LEGACY_STATUS_MAP = {
  "ระหว่างดำเนินการ": "ต่อเนื่องในครั้งถัดไป",
  "ต่อเนื่องวันถัดไป": "ต่อเนื่องในครั้งถัดไป",
  "อัปเดตแล้ว": "ต่อเนื่องในครั้งถัดไป",
};

const elements = {
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  staffFilter: document.querySelector("#staffFilter"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  dashboardSubtitle: document.querySelector("#dashboardSubtitle"),
  metricTotal: document.querySelector("#metricTotal"),
  metricDuration: document.querySelector("#metricDuration"),
  metricDone: document.querySelector("#metricDone"),
  metricDoneTime: document.querySelector("#metricDoneTime"),
  metricFailed: document.querySelector("#metricFailed"),
  metricFailedTime: document.querySelector("#metricFailedTime"),
  metricContinue: document.querySelector("#metricContinue"),
  metricContinueTime: document.querySelector("#metricContinueTime"),
  metricCanceled: document.querySelector("#metricCanceled"),
  metricCanceledTime: document.querySelector("#metricCanceledTime"),
  categoryList: document.querySelector("#categoryList"),
  subCategoryList: document.querySelector("#subCategoryList"),
  staffRows: document.querySelector("#staffRows"),
  categoryStatusRows: document.querySelector("#categoryStatusRows"),
  staffCategoryList: document.querySelector("#staffCategoryList"),
};

const params = new URLSearchParams(window.location.search);
const selectedToken = params.get("token") || MANAGER_TOKEN;
let allLogs = [];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function normalizeModernYear(year) {
  if (year >= 1900 && year < 2000) return year + 57;
  return year;
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

function dateLikeToIso(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return `${normalizeModernYear(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      const year = normalizeModernYear(date.getFullYear());
      return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }
  return thaiDateToIso(text);
}

function getLogIsoDate(log) {
  return dateLikeToIso(log.work_date_iso) || dateLikeToIso(log.work_date) || "";
}

function isoToThaiShortDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String((year + 543) % 100).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeStatus(status) {
  const text = String(status || "").trim();
  return LEGACY_STATUS_MAP[text] || text || "ไม่ระบุ";
}

function normalizeDuration(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

function durationLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ชม. ${m} นาที`;
  if (h) return `${h} ชม.`;
  return `${m} นาที`;
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function jsonpRequest(baseUrl, requestParams = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `itSupportDashboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(requestParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ"));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ"));
    };
    script.src = url.toString();
    document.body.append(script);
  });
}

function normalizeLog(log) {
  return {
    ...log,
    status: normalizeStatus(log.status),
    duration_minutes: normalizeDuration(log.duration_minutes),
    main_category: String(log.main_category || "ไม่ระบุหมวดงาน").trim() || "ไม่ระบุหมวดงาน",
    sub_category: String(log.sub_category || "ไม่ระบุประเภทย่อย").trim() || "ไม่ระบุประเภทย่อย",
    staff_name: String(log.staff_name || "ไม่ระบุเจ้าหน้าที่").trim() || "ไม่ระบุเจ้าหน้าที่",
  };
}

async function fetchDashboardLogs() {
  const data = await jsonpRequest(GOOGLE_SCRIPT_URL, {
    action: "list",
    scope: "all",
    token: selectedToken,
  });
  if (!data.ok || !Array.isArray(data.logs)) {
    throw new Error(data.error || "โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ");
  }
  return data.logs.map(normalizeLog);
}

function setDefaultDateRange(logs) {
  const dates = logs.map(getLogIsoDate).filter(Boolean).sort();
  const end = dates.at(-1) || today();
  const start = dates[0] || addDays(end, -30);
  elements.dateFrom.value = start;
  elements.dateTo.value = end;
}

function filteredLogs() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  return allLogs.filter((log) => {
    const date = getLogIsoDate(log);
    return date && date >= from && date <= to && (!staff || log.staff_name === staff);
  });
}

function createBucket(label) {
  return {
    label,
    count: 0,
    minutes: 0,
    statuses: Object.fromEntries(STATUS_LABELS.map((status) => [status, 0])),
  };
}

function addToBucket(bucket, log) {
  bucket.count += 1;
  bucket.minutes += normalizeDuration(log.duration_minutes);
  if (bucket.statuses[log.status] !== undefined) bucket.statuses[log.status] += 1;
}

function groupBy(logs, keyFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = keyFn(log) || "ไม่ระบุ";
    if (!map.has(key)) map.set(key, createBucket(key));
    addToBucket(map.get(key), log);
  });
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes || b.count - a.count);
}

function topLabel(groups) {
  if (!groups.length) return "-";
  const first = groups[0];
  return `${first.label} (${durationLabel(first.minutes)})`;
}

function renderMetricSummary(logs) {
  const totalMinutes = logs.reduce((sum, log) => sum + normalizeDuration(log.duration_minutes), 0);
  const byStatus = Object.fromEntries(STATUS_LABELS.map((status) => [status, { count: 0, minutes: 0 }]));
  logs.forEach((log) => {
    if (!byStatus[log.status]) return;
    byStatus[log.status].count += 1;
    byStatus[log.status].minutes += normalizeDuration(log.duration_minutes);
  });

  elements.metricTotal.textContent = logs.length;
  elements.metricDuration.textContent = durationLabel(totalMinutes);
  elements.metricDone.textContent = byStatus["สำเร็จ"].count;
  elements.metricDoneTime.textContent = durationLabel(byStatus["สำเร็จ"].minutes);
  elements.metricFailed.textContent = byStatus["ไม่สำเร็จ"].count;
  elements.metricFailedTime.textContent = durationLabel(byStatus["ไม่สำเร็จ"].minutes);
  elements.metricContinue.textContent = byStatus["ต่อเนื่องในครั้งถัดไป"].count;
  elements.metricContinueTime.textContent = durationLabel(byStatus["ต่อเนื่องในครั้งถัดไป"].minutes);
  elements.metricCanceled.textContent = byStatus["ยกเลิก"].count;
  elements.metricCanceledTime.textContent = durationLabel(byStatus["ยกเลิก"].minutes);
}

function renderBarList(container, groups, options = {}) {
  const { limit = 10, empty = "ไม่พบข้อมูลในช่วงเวลานี้" } = options;
  const rows = groups.slice(0, limit);
  const maxMinutes = Math.max(...rows.map((row) => row.minutes), 1);
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(empty)}</div>`;
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const width = Math.max(5, percent(row.minutes, maxMinutes));
      return `
        <article class="dashboard-bar-row">
          <div class="dashboard-bar-head">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${row.count} รายการ · ${durationLabel(row.minutes)}</span>
          </div>
          <div class="dashboard-bar-track">
            <div class="dashboard-bar-fill" style="width:${width}%"></div>
          </div>
          <div class="dashboard-status-line">
            ${STATUS_LABELS.map((status) => `<span>${escapeHtml(status)} ${row.statuses[status] || 0}</span>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStaffRows(logs) {
  const staffGroups = groupBy(logs, (log) => log.staff_name);
  if (!staffGroups.length) {
    elements.staffRows.innerHTML = '<tr><td colspan="9"><div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.staffRows.innerHTML = staffGroups
    .map((staff) => {
      const staffLogs = logs.filter((log) => log.staff_name === staff.label);
      const categoryTop = topLabel(groupBy(staffLogs, (log) => log.main_category));
      const subCategoryTop = topLabel(groupBy(staffLogs, (log) => log.sub_category));
      return `
        <tr>
          <td><strong>${escapeHtml(staff.label)}</strong></td>
          <td>${staff.count}</td>
          <td>${durationLabel(staff.minutes)}</td>
          <td>${staff.statuses["สำเร็จ"] || 0}</td>
          <td>${staff.statuses["ไม่สำเร็จ"] || 0}</td>
          <td>${staff.statuses["ต่อเนื่องในครั้งถัดไป"] || 0}</td>
          <td>${staff.statuses["ยกเลิก"] || 0}</td>
          <td>${escapeHtml(categoryTop)}</td>
          <td>${escapeHtml(subCategoryTop)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCategoryStatusRows(groups) {
  if (!groups.length) {
    elements.categoryStatusRows.innerHTML = '<tr><td colspan="6"><div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.categoryStatusRows.innerHTML = groups
    .map(
      (group) => `
        <tr>
          <td><strong>${escapeHtml(group.label)}</strong><br><small>${group.count} รายการ</small></td>
          <td>${group.statuses["สำเร็จ"] || 0}</td>
          <td>${group.statuses["ไม่สำเร็จ"] || 0}</td>
          <td>${group.statuses["ต่อเนื่องในครั้งถัดไป"] || 0}</td>
          <td>${group.statuses["ยกเลิก"] || 0}</td>
          <td>${durationLabel(group.minutes)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderStaffCategoryList(logs) {
  const groups = groupBy(logs, (log) => `${log.staff_name} · ${log.main_category}`);
  renderBarList(elements.staffCategoryList, groups, { limit: 15 });
}

function renderDashboard() {
  const logs = filteredLogs();
  const from = elements.dateFrom.value ? isoToThaiShortDate(elements.dateFrom.value) : "-";
  const to = elements.dateTo.value ? isoToThaiShortDate(elements.dateTo.value) : "-";
  elements.dashboardSubtitle.textContent = `ช่วงวันที่ ${from} ถึง ${to} · ${logs.length} รายการ`;

  const categoryGroups = groupBy(logs, (log) => log.main_category);
  const subCategoryGroups = groupBy(logs, (log) => log.sub_category);
  renderMetricSummary(logs);
  renderBarList(elements.categoryList, categoryGroups, { limit: 10 });
  renderBarList(elements.subCategoryList, subCategoryGroups, { limit: 12 });
  renderStaffRows(logs);
  renderCategoryStatusRows(categoryGroups);
  renderStaffCategoryList(logs);
}

async function loadDashboard() {
  elements.refreshDashboard.disabled = true;
  elements.dashboardSubtitle.textContent = "กำลังโหลดข้อมูลจาก Google Sheet...";
  try {
    allLogs = await fetchDashboardLogs();
    if (!elements.dateFrom.value || !elements.dateTo.value) setDefaultDateRange(allLogs);
    renderDashboard();
  } catch (error) {
    allLogs = [];
    elements.dashboardSubtitle.textContent = error.message || "โหลดข้อมูลไม่สำเร็จ";
    renderDashboard();
  } finally {
    elements.refreshDashboard.disabled = false;
  }
}

elements.dateFrom.addEventListener("change", renderDashboard);
elements.dateTo.addEventListener("change", renderDashboard);
elements.staffFilter.addEventListener("change", renderDashboard);
elements.refreshDashboard.addEventListener("click", loadDashboard);

loadDashboard();
