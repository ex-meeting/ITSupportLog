const STORAGE_KEY = "it-support-daily-work-logs";
const SUMMARY_AUTH_KEY = "it-support-summary-auth";
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
  backToForm: document.querySelector("#backToForm"),
};

const params = new URLSearchParams(window.location.search);
const selectedStaff = params.get("staff") || "";
const selectedDate = params.get("date") || today();
const selectedToken = params.get("token") || "";
const selectedScope = params.get("scope") || "";
const isManagerView = selectedScope === "all";
const summaryAuth = loadSummaryAuth();
let activeLogs = null;

const staffRouteMap = {
  "นายมนตรี กิ่งแก้ว": "montree",
  "จสอ.ธนบดี ข่ายม่าน": "tanabodee",
  "นายสมพงษ์ แสนชา": "somphong",
};

function loadSummaryAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(SUMMARY_AUTH_KEY)) || {};
  } catch {
    return {};
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isoToThaiDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year + 543}`;
}

function isoToThaiShortDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String((year + 543) % 100).padStart(2, "0")}`;
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
  return dateLikeToIso(log.work_date_iso) || dateLikeToIso(log.work_date) || log.work_date;
}

function formatDisplayDate(value) {
  const iso = dateLikeToIso(value);
  return iso ? isoToThaiShortDate(iso) : String(value || "-");
}

function formatDisplayTime(value) {
  if (!value) return "";
  const text = String(value).trim();
  const timeMatch = text.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    return `${String(Number(timeMatch[1])).padStart(2, "0")}:${timeMatch[2]}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }
  }

  return text;
}

function formatTimeRange(log) {
  const start = formatDisplayTime(log.start_time);
  const end = formatDisplayTime(log.end_time);
  return `${start}${end ? `-${end}` : ""}`;
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
    attachment_urls: Array.isArray(log.attachment_urls)
      ? log.attachment_urls
      : String(log.attachment_urls || "")
          .split(";")
          .map((url) => url.trim())
          .filter(Boolean),
  };
}

async function fetchSheetLogs() {
  if (!GOOGLE_SCRIPT_URL) return null;
  const requestParams = isManagerView
    ? {
        action: "list",
        scope: "all",
        token: selectedToken,
      }
    : {
        action: "list",
        staff: selectedStaff,
        token: selectedToken || (summaryAuth.staff === selectedStaff ? summaryAuth.token : ""),
      };
  const data = await jsonpRequest(GOOGLE_SCRIPT_URL, {
    ...requestParams,
  });
  if (!data.ok || !Array.isArray(data.logs)) throw new Error(data.error || "Cannot load logs");
  return data.logs.map(normalizeSheetLog);
}

function jsonpRequest(baseUrl, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `itSupportLogCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
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

function allLogs() {
  return activeLogs || [];
}

function staffLogs() {
  if (isManagerView) return allLogs();
  return allLogs().filter((log) => !selectedStaff || log.staff_name === selectedStaff);
}

function filteredLogs() {
  const text = elements.searchText.value.trim().toLowerCase();
  const status = elements.filterStatus.value;

  return staffLogs()
    .filter((log) => !status || log.status === status)
    .filter((log) => {
      if (!text) return true;
      return [log.staff_name, log.work_title, log.work_detail, log.main_category, log.sub_category, log.result_note, log.attachment_names]
        .join(" ")
        .toLowerCase()
        .includes(text);
    })
    .sort((a, b) =>
      `${getLogIsoDate(b)} ${formatDisplayTime(b.start_time)}`.localeCompare(
        `${getLogIsoDate(a)} ${formatDisplayTime(a.start_time)}`,
      ),
    );
}

function renderSummary() {
  const todayLogs = staffLogs().filter((log) => getLogIsoDate(log) === selectedDate);
  elements.summaryStaff.textContent = isManagerView ? "ภาพรวมเจ้าหน้าที่ทุกคน" : selectedStaff || "ไม่ระบุเจ้าหน้าที่";
  elements.summaryDate.textContent = formatDisplayDate(selectedDate);
  elements.countAll.textContent = todayLogs.length;
  elements.countDone.textContent = todayLogs.filter((log) => log.status === "สำเร็จ").length;
  elements.countDoing.textContent = todayLogs.filter((log) => log.status === "ระหว่างดำเนินการ").length;
  elements.countFailed.textContent = todayLogs.filter((log) => log.status === "ไม่สำเร็จ").length;

  const recent = todayLogs
    .sort((a, b) => formatDisplayTime(b.start_time).localeCompare(formatDisplayTime(a.start_time)))
    .slice(0, 8);
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
          <p>${escapeHtml(formatTimeRange(log))} · ${durationLabel(log.duration_minutes)}${isManagerView ? ` · ${escapeHtml(log.staff_name || "-")}` : ""}</p>
          <p>${escapeHtml(log.main_category)}</p>
        </article>
      `,
    )
    .join("");
}

function renderTable() {
  const logs = filteredLogs();
  elements.tableSubtitle.textContent = isManagerView
    ? "แสดงรายการของเจ้าหน้าที่ทุกคนจาก Google Sheet"
    : selectedStaff
    ? `แสดงเฉพาะรายการของ ${selectedStaff}`
    : "ไม่ได้ระบุเจ้าหน้าที่";

  if (!logs.length) {
    elements.logRows.innerHTML = '<tr><td colspan="8"><div class="empty-state">ไม่พบรายการตามเงื่อนไข</div></td></tr>';
    return;
  }

  elements.logRows.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(formatDisplayDate(getLogIsoDate(log)))}</td>
          <td>${escapeHtml(formatTimeRange(log))}<br><small>${durationLabel(log.duration_minutes)}</small></td>
          <td>${escapeHtml(log.staff_name || "-")}<br><small>${escapeHtml(log.staff_email || "")}</small></td>
          <td><strong>${escapeHtml(log.work_title)}</strong><br><small>${escapeHtml(log.work_detail).slice(0, 120)}</small></td>
          <td>${escapeHtml(log.main_category)}<br><small>${escapeHtml(log.sub_category)}</small></td>
          <td><span class="${statusClass(log.status)}">${escapeHtml(log.status)}</span></td>
          <td>${escapeHtml(log.result_note || "-")}</td>
          <td>${renderAttachments(log)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderAttachments(log) {
  const names = Array.isArray(log.attachment_names) ? log.attachment_names : [];
  const urls = Array.isArray(log.attachment_urls) ? log.attachment_urls : [];
  if (!names.length && !urls.length) return "-";

  const total = Math.max(names.length, urls.length);
  const links = [];
  for (let index = 0; index < total; index += 1) {
    const name = names[index] || `ไฟล์แนบ ${index + 1}`;
    const url = urls[index] || "";
    const isUrl = /^https?:\/\//i.test(url);
    links.push(
      isUrl
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
        : escapeHtml(url || name),
    );
  }
  return `<div class="attachment-list">${links.join("")}</div>`;
}

function renderAll() {
  renderSummary();
  renderTable();
}

function updateBackLink() {
  if (isManagerView) {
    elements.backToForm.href = "./manager.html?v=20260706-03";
    elements.backToForm.textContent = "สรุปภาพรวมผู้บริหาร";
    return;
  }
  const staffKey = staffRouteMap[selectedStaff] || selectedStaff;
  const token = selectedToken || (summaryAuth.staff === selectedStaff ? summaryAuth.token : "");
  if (selectedStaff && token) {
    elements.backToForm.href = `./index.html?staff=${encodeURIComponent(staffKey)}&token=${encodeURIComponent(token)}`;
  }
}

elements.searchText.addEventListener("input", renderTable);
elements.filterStatus.addEventListener("change", renderTable);

async function init() {
  updateBackLink();
  const accessToken = selectedToken || (summaryAuth.staff === selectedStaff ? summaryAuth.token : "");
  if (isManagerView && !selectedToken) {
    activeLogs = [];
    renderAll();
    elements.recentList.innerHTML = '<div class="empty-state">กรุณาเปิดหน้าสรุปจากลิงก์สำหรับผู้บริหาร</div>';
    return;
  }
  if (!isManagerView && (!selectedStaff || !accessToken)) {
    activeLogs = [];
    renderAll();
    elements.recentList.innerHTML = '<div class="empty-state">กรุณาเปิดหน้าสรุปจากลิงก์เฉพาะเจ้าหน้าที่</div>';
    return;
  }
  try {
    activeLogs = await fetchSheetLogs();
  } catch (error) {
    activeLogs = [];
    renderAll();
    elements.recentList.innerHTML = `<div class="empty-state">${escapeHtml(error.message || "โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ")}</div>`;
    elements.logRows.innerHTML = `<tr><td colspan="8"><div class="empty-state">${escapeHtml(error.message || "โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ")}</div></td></tr>`;
    return;
  }
  renderAll();
}

init();
