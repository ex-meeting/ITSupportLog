const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHp434IfxY6I6aa2RVXcn4McRGKojBsZRvNx40N5qyIZP3aJrwYUriYtZNtSXGKEPTEA/exec";
const MANAGER_TOKEN = "MANAGER_TOKEN_20260706_B7N5Q2";

const SCORE_FIELDS = [
  { key: "speed_score", label: "ความรวดเร็ว" },
  { key: "communication_score", label: "การสื่อสาร" },
  { key: "technical_score", label: "ความสามารถ" },
  { key: "clarity_score", label: "คำแนะนำ" },
  { key: "outcome_score", label: "ผลลัพธ์" },
  { key: "overall_score", label: "ความพึงพอใจรวม" },
];

const elements = {
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  staffFilter: document.querySelector("#staffFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  refreshSatisfaction: document.querySelector("#refreshSatisfaction"),
  satisfactionSubtitle: document.querySelector("#satisfactionSubtitle"),
  metricTotal: document.querySelector("#metricTotal"),
  metricCoverage: document.querySelector("#metricCoverage"),
  metricOverall: document.querySelector("#metricOverall"),
  metricOverallLabel: document.querySelector("#metricOverallLabel"),
  metricLowScore: document.querySelector("#metricLowScore"),
  metricCommunication: document.querySelector("#metricCommunication"),
  dimensionList: document.querySelector("#dimensionList"),
  monthlyList: document.querySelector("#monthlyList"),
  staffRows: document.querySelector("#staffRows"),
  categoryList: document.querySelector("#categoryList"),
  subCategoryList: document.querySelector("#subCategoryList"),
  followUpRows: document.querySelector("#followUpRows"),
};

const params = new URLSearchParams(window.location.search);
const selectedToken = params.get("token") || MANAGER_TOKEN;
let allEvaluations = [];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function thaiDateToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

function normalizeScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function average(values) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function jsonpRequest(baseUrl, requestParams = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `itSupportSatisfactionDashboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(requestParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("โหลดข้อมูลผลประเมินจาก Google Sheet ไม่สำเร็จ"));
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
      reject(new Error("โหลดข้อมูลผลประเมินจาก Google Sheet ไม่สำเร็จ"));
    };
    script.src = url.toString();
    document.body.append(script);
  });
}

function normalizeEvaluation(item) {
  return {
    ...item,
    submitted_date: thaiDateToIso(item.submitted_at) || thaiDateToIso(item.service_date),
    service_date: thaiDateToIso(item.service_date),
    staff_name: String(item.staff_name || "ไม่ระบุเจ้าหน้าที่").trim() || "ไม่ระบุเจ้าหน้าที่",
    main_category: String(item.main_category || "ไม่ระบุหมวดงาน").trim() || "ไม่ระบุหมวดงาน",
    sub_category: String(item.sub_category || "ไม่ระบุประเภทย่อย").trim() || "ไม่ระบุประเภทย่อย",
    work_title: String(item.work_title || "-").trim() || "-",
    suggestion: String(item.suggestion || "").trim(),
    ...Object.fromEntries(SCORE_FIELDS.map((field) => [field.key, normalizeScore(item[field.key])])),
  };
}

async function fetchSatisfactionData() {
  const data = await jsonpRequest(GOOGLE_SCRIPT_URL, {
    action: "satisfaction_list",
    token: selectedToken,
  });
  if (!data.ok || !Array.isArray(data.evaluations)) {
    throw new Error(data.error || "โหลดข้อมูลผลประเมินไม่สำเร็จ");
  }
  return data.evaluations.map(normalizeEvaluation);
}

function setDefaultDateRange(rows) {
  const dates = rows.map((row) => row.submitted_date || row.service_date).filter(Boolean).sort();
  const end = dates.at(-1) || today();
  const start = dates[0] || addDays(end, -90);
  elements.dateFrom.value = start;
  elements.dateTo.value = end;
}

function populateCategoryFilter(rows) {
  const current = elements.categoryFilter.value;
  const categories = [...new Set(rows.map((row) => row.main_category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  elements.categoryFilter.innerHTML = '<option value="">หมวดงานทุกประเภท</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  if (categories.includes(current)) elements.categoryFilter.value = current;
}

function filteredRows() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  const category = elements.categoryFilter.value;
  return allEvaluations.filter((row) => {
    const date = row.submitted_date || row.service_date;
    return date && date >= from && date <= to &&
      (!staff || row.staff_name === staff) &&
      (!category || row.main_category === category);
  });
}

function createScoreBucket(label) {
  return {
    label,
    count: 0,
    lowScore: 0,
    scores: Object.fromEntries(SCORE_FIELDS.map((field) => [field.key, []])),
  };
}

function addToScoreBucket(bucket, row) {
  bucket.count += 1;
  if (row.overall_score > 0 && row.overall_score <= 3) bucket.lowScore += 1;
  SCORE_FIELDS.forEach((field) => {
    if (row[field.key] > 0) bucket.scores[field.key].push(row[field.key]);
  });
}

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || "ไม่ระบุ";
    if (!map.has(key)) map.set(key, createScoreBucket(key));
    addToScoreBucket(map.get(key), row);
  });
  return Array.from(map.values()).sort((a, b) =>
    average(b.scores.overall_score) - average(a.scores.overall_score) || b.count - a.count,
  );
}

function bucketAverage(bucket, key = "overall_score") {
  return average(bucket.scores[key]);
}

function renderMetricSummary(rows) {
  const uniqueLogs = new Set(rows.map((row) => row.log_id).filter(Boolean)).size;
  const overall = average(rows.map((row) => row.overall_score));
  const communication = average(rows.map((row) => row.communication_score));
  const lowScore = rows.filter((row) => row.overall_score > 0 && row.overall_score <= 3).length;
  elements.metricTotal.textContent = rows.length;
  elements.metricCoverage.textContent = `${uniqueLogs} งานที่ถูกประเมิน`;
  elements.metricOverall.textContent = overall.toFixed(2);
  elements.metricOverallLabel.textContent = overall ? `${overall >= 4 ? "ระดับดีมาก" : "ควรติดตาม"}` : "ไม่มีข้อมูลคะแนน";
  elements.metricLowScore.textContent = lowScore;
  elements.metricCommunication.textContent = communication.toFixed(2);
}

function renderScoreBarList(container, groups, options = {}) {
  const { limit = 10, empty = "ไม่พบข้อมูลในช่วงเวลานี้", showDetails = true } = options;
  const rows = groups.slice(0, limit);
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(empty)}</div>`;
    return;
  }

  container.innerHTML = rows.map((row) => {
    const score = bucketAverage(row);
    const width = Math.max(4, percent(score, 5));
    return `
      <article class="dashboard-bar-row satisfaction-score-row">
        <div class="dashboard-bar-head">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${row.count} แบบประเมิน · ${score.toFixed(2)} / 5</span>
        </div>
        <div class="dashboard-bar-track">
          <div class="dashboard-bar-fill score-fill" style="width:${width}%"></div>
        </div>
        ${showDetails ? `<div class="dashboard-status-line">
          <span>คะแนนต่ำ ${row.lowScore}</span>
          <span>สื่อสาร ${bucketAverage(row, "communication_score").toFixed(2)}</span>
          <span>ผลลัพธ์ ${bucketAverage(row, "outcome_score").toFixed(2)}</span>
        </div>` : ""}
      </article>
    `;
  }).join("");
}

function renderDimensionList(rows) {
  const groups = SCORE_FIELDS.map((field) => {
    const bucket = createScoreBucket(field.label);
    rows.forEach((row) => {
      if (row[field.key] > 0) bucket.scores.overall_score.push(row[field.key]);
    });
    bucket.count = bucket.scores.overall_score.length;
    return bucket;
  });
  renderScoreBarList(elements.dimensionList, groups, {
    limit: SCORE_FIELDS.length,
    showDetails: false,
  });
}

function renderMonthlyList(rows) {
  const groups = groupBy(rows, (row) => {
    const date = row.submitted_date || row.service_date || "";
    if (!date) return "";
    const [year, month] = date.split("-");
    return `${year}-${month}`;
  }).sort((a, b) => a.label.localeCompare(b.label));
  groups.forEach((group) => {
    const [year, month] = group.label.split("-");
    group.label = `${month}/${String((Number(year) + 543) % 100).padStart(2, "0")}`;
  });
  renderScoreBarList(elements.monthlyList, groups, { limit: 18 });
}

function renderStaffRows(rows) {
  const groups = groupBy(rows, (row) => row.staff_name);
  if (!groups.length) {
    elements.staffRows.innerHTML = '<tr><td colspan="9"><div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div></td></tr>';
    return;
  }
  elements.staffRows.innerHTML = groups.map((group) => `
    <tr>
      <td><strong>${escapeHtml(group.label)}</strong></td>
      <td>${group.count}</td>
      <td>${bucketAverage(group).toFixed(2)}</td>
      <td>${bucketAverage(group, "speed_score").toFixed(2)}</td>
      <td>${bucketAverage(group, "communication_score").toFixed(2)}</td>
      <td>${bucketAverage(group, "technical_score").toFixed(2)}</td>
      <td>${bucketAverage(group, "clarity_score").toFixed(2)}</td>
      <td>${bucketAverage(group, "outcome_score").toFixed(2)}</td>
      <td>${group.lowScore}</td>
    </tr>
  `).join("");
}

function renderFollowUpRows(rows) {
  const targets = [...rows]
    .filter((row) => (row.overall_score > 0 && row.overall_score <= 3) || row.suggestion)
    .sort((a, b) => String(b.submitted_at || "").localeCompare(String(a.submitted_at || "")))
    .slice(0, 30);

  if (!targets.length) {
    elements.followUpRows.innerHTML = '<tr><td colspan="6"><div class="empty-state">ไม่พบรายการที่ต้องติดตามในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.followUpRows.innerHTML = targets.map((row) => `
    <tr>
      <td>${escapeHtml(isoToThaiShortDate(row.submitted_date || row.service_date))}</td>
      <td>${escapeHtml(row.staff_name)}</td>
      <td><strong>${escapeHtml(row.work_title)}</strong><br><small>${escapeHtml(row.log_id || "")}</small></td>
      <td>${escapeHtml(row.main_category)}</td>
      <td>${row.overall_score ? row.overall_score.toFixed(2) : "-"}</td>
      <td>${escapeHtml(row.suggestion || "-")}</td>
    </tr>
  `).join("");
}

function renderDashboard() {
  const rows = filteredRows();
  const from = elements.dateFrom.value ? isoToThaiShortDate(elements.dateFrom.value) : "-";
  const to = elements.dateTo.value ? isoToThaiShortDate(elements.dateTo.value) : "-";
  elements.satisfactionSubtitle.textContent = `ช่วงวันที่ ${from} ถึง ${to} · ${rows.length} แบบประเมิน`;
  renderMetricSummary(rows);
  renderDimensionList(rows);
  renderMonthlyList(rows);
  renderStaffRows(rows);
  renderScoreBarList(elements.categoryList, groupBy(rows, (row) => row.main_category), { limit: 10 });
  renderScoreBarList(elements.subCategoryList, groupBy(rows, (row) => row.sub_category), { limit: 12 });
  renderFollowUpRows(rows);
}

async function loadDashboard() {
  elements.refreshSatisfaction.disabled = true;
  elements.satisfactionSubtitle.textContent = "กำลังโหลดข้อมูลผลประเมินจาก Google Sheet...";
  try {
    allEvaluations = await fetchSatisfactionData();
    populateCategoryFilter(allEvaluations);
    if (!elements.dateFrom.value || !elements.dateTo.value) setDefaultDateRange(allEvaluations);
    renderDashboard();
  } catch (error) {
    allEvaluations = [];
    populateCategoryFilter([]);
    elements.satisfactionSubtitle.textContent = error.message || "โหลดข้อมูลไม่สำเร็จ";
    renderDashboard();
  } finally {
    elements.refreshSatisfaction.disabled = false;
  }
}

elements.dateFrom.addEventListener("change", renderDashboard);
elements.dateTo.addEventListener("change", renderDashboard);
elements.staffFilter.addEventListener("change", renderDashboard);
elements.categoryFilter.addEventListener("change", renderDashboard);
elements.refreshSatisfaction.addEventListener("click", loadDashboard);

loadDashboard();
