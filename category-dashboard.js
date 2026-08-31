const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHp434IfxY6I6aa2RVXcn4McRGKojBsZRvNx40N5qyIZP3aJrwYUriYtZNtSXGKEPTEA/exec";
const MANAGER_TOKEN = "MANAGER_TOKEN_20260706_B7N5Q2";
const JSONP_TIMEOUT_MS = 60000;

const elements = {
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  staffFilter: document.querySelector("#staffFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  subCategoryFilter: document.querySelector("#subCategoryFilter"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  dashboardSubtitle: document.querySelector("#dashboardSubtitle"),
  metricTotal: document.querySelector("#metricTotal"),
  metricDuration: document.querySelector("#metricDuration"),
  metricCategories: document.querySelector("#metricCategories"),
  metricSubCategories: document.querySelector("#metricSubCategories"),
  metricPairs: document.querySelector("#metricPairs"),
  categoryTree: document.querySelector("#categoryTree"),
  subCategoryTree: document.querySelector("#subCategoryTree"),
  categoryBars: document.querySelector("#categoryBars"),
  subCategoryBars: document.querySelector("#subCategoryBars"),
  relationshipRows: document.querySelector("#relationshipRows"),
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

function normalizeText(value, fallback) {
  return String(value || fallback).trim() || fallback;
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
    const callbackName = `itSupportCategoryCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(requestParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ"));
    }, JSONP_TIMEOUT_MS);

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
    work_date_iso: getLogIsoDate(log),
    duration_minutes: normalizeDuration(log.duration_minutes),
    staff_name: normalizeText(log.staff_name, "ไม่ระบุเจ้าหน้าที่"),
    main_category: normalizeText(log.main_category, "ไม่ระบุหมวดงาน"),
    sub_category: normalizeText(log.sub_category, "ไม่ระบุประเภทงานย่อย"),
    work_title: normalizeText(log.work_title, "-"),
  };
}

async function fetchLogs() {
  const data = await jsonpRequest(GOOGLE_SCRIPT_URL, {
    action: "list",
    scope: "all",
    token: selectedToken,
  });
  if (!data.ok || !Array.isArray(data.logs)) {
    throw new Error(data.error || "โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ");
  }
  return data.logs.map(normalizeLog).filter((log) => log.work_date_iso);
}

function uniqueValues(rows, field) {
  return [...new Set(rows.map((row) => normalizeText(row[field], "")).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "th"),
  );
}

function setSelectOptions(select, values, allLabel) {
  const selected = select.value;
  select.innerHTML = [
    `<option value="">${escapeHtml(allLabel)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`),
  ].join("");
  if (values.includes(selected)) select.value = selected;
}

function setDefaultDateRange(logs) {
  const dates = logs.map((log) => log.work_date_iso).filter(Boolean).sort();
  const end = dates.at(-1) || today();
  const start = dates[0] || addDays(end, -30);
  elements.dateFrom.value = start;
  elements.dateTo.value = end;
}

function logsForOptionFilters() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  return allLogs.filter((log) => log.work_date_iso >= from && log.work_date_iso <= to && (!staff || log.staff_name === staff));
}

function updateFilterOptions() {
  const dateAndStaffLogs = logsForOptionFilters();
  const category = elements.categoryFilter.value;
  setSelectOptions(elements.staffFilter, uniqueValues(allLogs, "staff_name"), "เจ้าหน้าที่ทุกคน");
  setSelectOptions(elements.categoryFilter, uniqueValues(dateAndStaffLogs, "main_category"), "ทุกหมวดงานหลัก");

  const subCategoryBase = category
    ? dateAndStaffLogs.filter((log) => log.main_category === category)
    : dateAndStaffLogs;
  setSelectOptions(elements.subCategoryFilter, uniqueValues(subCategoryBase, "sub_category"), "ทุกประเภทงานย่อย");
}

function filteredLogs() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  const category = elements.categoryFilter.value;
  const subCategory = elements.subCategoryFilter.value;
  return allLogs.filter(
    (log) =>
      log.work_date_iso >= from &&
      log.work_date_iso <= to &&
      (!staff || log.staff_name === staff) &&
      (!category || log.main_category === category) &&
      (!subCategory || log.sub_category === subCategory),
  );
}

function createBucket(label) {
  return {
    label,
    count: 0,
    minutes: 0,
    staffNames: new Set(),
    latestDate: "",
    latestTitle: "",
  };
}

function addToBucket(bucket, log) {
  bucket.count += 1;
  bucket.minutes += log.duration_minutes;
  bucket.staffNames.add(log.staff_name);
  if (!bucket.latestDate || log.work_date_iso > bucket.latestDate) {
    bucket.latestDate = log.work_date_iso;
    bucket.latestTitle = log.work_title;
  }
}

function groupBy(logs, keyFn) {
  const map = new Map();
  logs.forEach((log) => {
    const key = keyFn(log) || "ไม่ระบุ";
    if (!map.has(key)) map.set(key, createBucket(key));
    addToBucket(map.get(key), log);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || b.minutes - a.minutes || a.label.localeCompare(b.label, "th"));
}

function relationshipGroups(logs) {
  const map = new Map();
  logs.forEach((log) => {
    const key = `${log.main_category}|||${log.sub_category}`;
    if (!map.has(key)) {
      map.set(key, {
        mainCategory: log.main_category,
        subCategory: log.sub_category,
        count: 0,
        minutes: 0,
        staffNames: new Set(),
        latestDate: "",
        latestTitle: "",
      });
    }
    const item = map.get(key);
    item.count += 1;
    item.minutes += log.duration_minutes;
    item.staffNames.add(log.staff_name);
    if (!item.latestDate || log.work_date_iso > item.latestDate) {
      item.latestDate = log.work_date_iso;
      item.latestTitle = log.work_title;
    }
  });
  return [...map.values()].sort(
    (a, b) =>
      a.mainCategory.localeCompare(b.mainCategory, "th") ||
      b.count - a.count ||
      a.subCategory.localeCompare(b.subCategory, "th"),
  );
}

function renderMetrics(logs, pairs) {
  const totalMinutes = logs.reduce((sum, log) => sum + log.duration_minutes, 0);
  elements.metricTotal.textContent = logs.length;
  elements.metricDuration.textContent = durationLabel(totalMinutes);
  elements.metricCategories.textContent = uniqueValues(logs, "main_category").length;
  elements.metricSubCategories.textContent = uniqueValues(logs, "sub_category").length;
  elements.metricPairs.textContent = pairs.length;
}

function renderBarList(container, groups, options = {}) {
  const { limit = 12, empty = "ไม่พบข้อมูลในช่วงเวลานี้" } = options;
  const rows = groups.slice(0, limit);
  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(empty)}</div>`;
    return;
  }

  container.innerHTML = rows
    .map((row) => {
      const width = Math.max(5, percent(row.count, maxCount));
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
            <span>เจ้าหน้าที่ ${row.staffNames.size} คน</span>
            <span>ล่าสุด ${escapeHtml(isoToThaiShortDate(row.latestDate) || "-")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCategoryTree(logs) {
  const categoryGroups = groupBy(logs, (log) => log.main_category);
  if (!categoryGroups.length) {
    elements.categoryTree.innerHTML = '<div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  elements.categoryTree.innerHTML = categoryGroups
    .map((category) => {
      const childGroups = groupBy(
        logs.filter((log) => log.main_category === category.label),
        (log) => log.sub_category,
      );
      return `
        <article class="relationship-card">
          <div class="relationship-card-head">
            <strong>${escapeHtml(category.label)}</strong>
            <span>${category.count} รายการ</span>
          </div>
          <div class="relationship-chip-list">
            ${childGroups
              .map((child) => `<button type="button" class="relationship-chip" data-filter-sub="${escapeHtml(child.label)}">${escapeHtml(child.label)} <span>${child.count}</span></button>`)
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSubCategoryTree(logs) {
  const subGroups = groupBy(logs, (log) => log.sub_category);
  if (!subGroups.length) {
    elements.subCategoryTree.innerHTML = '<div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  elements.subCategoryTree.innerHTML = subGroups
    .slice(0, 30)
    .map((subCategory) => {
      const parentGroups = groupBy(
        logs.filter((log) => log.sub_category === subCategory.label),
        (log) => log.main_category,
      );
      const multiParentClass = parentGroups.length > 1 ? " has-multiple-parents" : "";
      return `
        <article class="relationship-card${multiParentClass}">
          <div class="relationship-card-head">
            <strong>${escapeHtml(subCategory.label)}</strong>
            <span>${subCategory.count} รายการ</span>
          </div>
          <div class="relationship-chip-list">
            ${parentGroups
              .map((parent) => `<button type="button" class="relationship-chip" data-filter-category="${escapeHtml(parent.label)}">${escapeHtml(parent.label)} <span>${parent.count}</span></button>`)
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRelationshipRows(pairs) {
  if (!pairs.length) {
    elements.relationshipRows.innerHTML = '<tr><td colspan="6"><div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.relationshipRows.innerHTML = pairs
    .map(
      (pair) => `
        <tr>
          <td><strong>${escapeHtml(pair.mainCategory)}</strong></td>
          <td>${escapeHtml(pair.subCategory)}</td>
          <td>${pair.count}</td>
          <td>${durationLabel(pair.minutes)}</td>
          <td>${escapeHtml([...pair.staffNames].sort((a, b) => a.localeCompare(b, "th")).join(", "))}</td>
          <td>${escapeHtml(isoToThaiShortDate(pair.latestDate) || "-")}<br><small>${escapeHtml(pair.latestTitle)}</small></td>
        </tr>
      `,
    )
    .join("");
}

function renderDashboard() {
  const logs = filteredLogs();
  const pairs = relationshipGroups(logs);
  const from = elements.dateFrom.value ? isoToThaiShortDate(elements.dateFrom.value) : "-";
  const to = elements.dateTo.value ? isoToThaiShortDate(elements.dateTo.value) : "-";
  elements.dashboardSubtitle.textContent = `ช่วงวันที่ ${from} ถึง ${to} · ${logs.length} รายการ`;
  renderMetrics(logs, pairs);
  renderCategoryTree(logs);
  renderSubCategoryTree(logs);
  renderBarList(elements.categoryBars, groupBy(logs, (log) => log.main_category), { limit: 12 });
  renderBarList(elements.subCategoryBars, groupBy(logs, (log) => log.sub_category), { limit: 12 });
  renderRelationshipRows(pairs);
}

function handleFilterChange(event) {
  if (event?.target === elements.staffFilter || event?.target === elements.dateFrom || event?.target === elements.dateTo || event?.target === elements.categoryFilter) {
    updateFilterOptions();
  }
  renderDashboard();
}

async function loadDashboard() {
  elements.refreshDashboard.disabled = true;
  elements.dashboardSubtitle.textContent = "กำลังโหลดข้อมูลจาก Google Sheet...";
  try {
    allLogs = await fetchLogs();
    if (!elements.dateFrom.value || !elements.dateTo.value) setDefaultDateRange(allLogs);
    updateFilterOptions();
    renderDashboard();
  } catch (error) {
    allLogs = [];
    elements.dashboardSubtitle.textContent = error.message || "โหลดข้อมูลไม่สำเร็จ";
    updateFilterOptions();
    renderDashboard();
  } finally {
    elements.refreshDashboard.disabled = false;
  }
}

elements.dateFrom.addEventListener("change", handleFilterChange);
elements.dateTo.addEventListener("change", handleFilterChange);
elements.staffFilter.addEventListener("change", handleFilterChange);
elements.categoryFilter.addEventListener("change", handleFilterChange);
elements.subCategoryFilter.addEventListener("change", handleFilterChange);
elements.refreshDashboard.addEventListener("click", loadDashboard);
elements.categoryTree.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-sub]");
  if (!button) return;
  elements.subCategoryFilter.value = button.dataset.filterSub;
  renderDashboard();
});
elements.subCategoryTree.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-category]");
  if (!button) return;
  elements.categoryFilter.value = button.dataset.filterCategory;
  updateFilterOptions();
  renderDashboard();
});

loadDashboard();
