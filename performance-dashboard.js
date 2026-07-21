const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHp434IfxY6I6aa2RVXcn4McRGKojBsZRvNx40N5qyIZP3aJrwYUriYtZNtSXGKEPTEA/exec";
const MANAGER_TOKEN = "MANAGER_TOKEN_20260706_B7N5Q2";

const STAFF_NAMES = ["นายมนตรี กิ่งแก้ว", "จสอ.ธนบดี ข่ายม่าน", "นายสมพงษ์ แสนชา"];
const STATUS_WEIGHTS = {
  "สำเร็จ": 1,
  "ต่อเนื่องในครั้งถัดไป": 0.6,
  "ไม่สำเร็จ": 0.3,
  "ยกเลิก": 0,
};
const LEGACY_STATUS_MAP = {
  "ระหว่างดำเนินการ": "ต่อเนื่องในครั้งถัดไป",
  "ต่อเนื่องวันถัดไป": "ต่อเนื่องในครั้งถัดไป",
  "อัปเดตแล้ว": "ต่อเนื่องในครั้งถัดไป",
};
const QUALITY_FIELDS = ["speed_score", "communication_score", "technical_score", "clarity_score", "outcome_score"];
const MIN_EVALUATIONS_FOR_FULL_CONFIDENCE = 5;

const elements = {
  dateFrom: document.querySelector("#dateFrom"),
  dateTo: document.querySelector("#dateTo"),
  staffFilter: document.querySelector("#staffFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  refreshPerformance: document.querySelector("#refreshPerformance"),
  performanceSubtitle: document.querySelector("#performanceSubtitle"),
  metricTotalScore: document.querySelector("#metricTotalScore"),
  metricQuantityScore: document.querySelector("#metricQuantityScore"),
  metricQualityScore: document.querySelector("#metricQualityScore"),
  metricLogs: document.querySelector("#metricLogs"),
  metricMinutes: document.querySelector("#metricMinutes"),
  metricEvaluations: document.querySelector("#metricEvaluations"),
  metricConfidence: document.querySelector("#metricConfidence"),
  staffRows: document.querySelector("#staffRows"),
  quantityList: document.querySelector("#quantityList"),
  qualityList: document.querySelector("#qualityList"),
  categoryList: document.querySelector("#categoryList"),
  followUpRows: document.querySelector("#followUpRows"),
};

const params = new URLSearchParams(window.location.search);
const selectedToken = params.get("token") || MANAGER_TOKEN;
let allLogs = [];
let allEvaluations = [];

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

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getLogIsoDate(log) {
  return thaiDateToIso(log.work_date_iso) || thaiDateToIso(log.work_date) || "";
}

function getEvaluationIsoDate(row) {
  return thaiDateToIso(row.submitted_at) || thaiDateToIso(row.service_date) || "";
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

function normalizeScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score > 0 ? score : 0;
}

function durationLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} ชม. ${m} นาที`;
  if (h) return `${h} ชม.`;
  return `${m} นาที`;
}

function average(values) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function averageAll(values) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function categoryWeight(category) {
  const text = String(category || "");
  if (/ระบบ|เครือข่าย|network|server|ฐานข้อมูล|security|ความปลอดภัย/i.test(text)) return 1.3;
  if (/พัฒนาระบบ|รายงาน|dashboard|นวัตกรรม|ปรับปรุงกระบวนการ/i.test(text)) return 1.3;
  if (/ซ่อม|เครื่อง|software|hardware|อุปกรณ์|โปรแกรม|โสต/i.test(text)) return 1.0;
  if (/ประชุม|ประสานงาน|นโยบาย|โครงการ|อื่น/i.test(text)) return 0.8;
  return 1.0;
}

function jsonpRequest(baseUrl, requestParams = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `itSupportPerformanceDashboardCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
  const status = normalizeStatus(log.status);
  const mainCategory = String(log.main_category || "ไม่ระบุหมวดงาน").trim() || "ไม่ระบุหมวดงาน";
  const weight = categoryWeight(mainCategory);
  return {
    ...log,
    status,
    status_weight: STATUS_WEIGHTS[status] ?? 0,
    duration_minutes: normalizeDuration(log.duration_minutes),
    main_category: mainCategory,
    sub_category: String(log.sub_category || "ไม่ระบุประเภทย่อย").trim() || "ไม่ระบุประเภทย่อย",
    staff_name: String(log.staff_name || "ไม่ระบุเจ้าหน้าที่").trim() || "ไม่ระบุเจ้าหน้าที่",
    category_weight: weight,
    weighted_work: weight * (STATUS_WEIGHTS[status] ?? 0),
  };
}

function normalizeEvaluation(item) {
  return {
    ...item,
    evaluation_date: getEvaluationIsoDate(item),
    staff_name: String(item.staff_name || "ไม่ระบุเจ้าหน้าที่").trim() || "ไม่ระบุเจ้าหน้าที่",
    main_category: String(item.main_category || "ไม่ระบุหมวดงาน").trim() || "ไม่ระบุหมวดงาน",
    sub_category: String(item.sub_category || "ไม่ระบุประเภทย่อย").trim() || "ไม่ระบุประเภทย่อย",
    overall_score: normalizeScore(item.overall_score),
    speed_score: normalizeScore(item.speed_score),
    communication_score: normalizeScore(item.communication_score),
    technical_score: normalizeScore(item.technical_score),
    clarity_score: normalizeScore(item.clarity_score),
    outcome_score: normalizeScore(item.outcome_score),
  };
}

async function fetchData() {
  const [logsData, satisfactionData] = await Promise.all([
    jsonpRequest(GOOGLE_SCRIPT_URL, { action: "list", scope: "all", token: selectedToken }),
    jsonpRequest(GOOGLE_SCRIPT_URL, { action: "satisfaction_list", token: selectedToken }),
  ]);
  if (!logsData.ok || !Array.isArray(logsData.logs)) {
    throw new Error(logsData.error || "โหลดข้อมูลบันทึกงานไม่สำเร็จ");
  }
  if (!satisfactionData.ok || !Array.isArray(satisfactionData.evaluations)) {
    throw new Error(satisfactionData.error || "โหลดข้อมูลประเมินความพึงพอใจไม่สำเร็จ");
  }
  return {
    logs: logsData.logs.map(normalizeLog),
    evaluations: satisfactionData.evaluations.map(normalizeEvaluation),
  };
}

function setDefaultDateRange(logs, evaluations) {
  const dates = [
    ...logs.map(getLogIsoDate),
    ...evaluations.map((row) => row.evaluation_date),
  ].filter(Boolean).sort();
  const end = dates.at(-1) || today();
  const start = dates[0] || addDays(end, -90);
  elements.dateFrom.value = start;
  elements.dateTo.value = end;
}

function populateCategoryFilter(logs, evaluations) {
  const current = elements.categoryFilter.value;
  const categories = [...new Set([
    ...logs.map((row) => row.main_category),
    ...evaluations.map((row) => row.main_category),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
  elements.categoryFilter.innerHTML = '<option value="">หมวดงานทุกประเภท</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  if (categories.includes(current)) elements.categoryFilter.value = current;
}

function filteredLogs() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  const category = elements.categoryFilter.value;
  return allLogs.filter((log) => {
    const date = getLogIsoDate(log);
    return date && date >= from && date <= to &&
      (!staff || log.staff_name === staff) &&
      (!category || log.main_category === category);
  });
}

function filteredEvaluations() {
  const from = elements.dateFrom.value || "0000-01-01";
  const to = elements.dateTo.value || "9999-12-31";
  const staff = elements.staffFilter.value;
  const category = elements.categoryFilter.value;
  return allEvaluations.filter((row) => {
    const date = row.evaluation_date;
    return date && date >= from && date <= to &&
      (!staff || row.staff_name === staff) &&
      (!category || row.main_category === category);
  });
}

function staffNamesForRows(logs, evaluations) {
  return [...new Set([
    ...STAFF_NAMES,
    ...logs.map((row) => row.staff_name),
    ...evaluations.map((row) => row.staff_name),
  ])].filter(Boolean);
}

function scoreStaff(staffName, logs, evaluations, maxima) {
  const staffLogs = logs.filter((log) => log.staff_name === staffName);
  const staffEvaluations = evaluations.filter((row) => row.staff_name === staffName);
  const logCount = staffLogs.length;
  const totalMinutes = staffLogs.reduce((sum, log) => sum + log.duration_minutes, 0);
  const weightedWork = staffLogs.reduce((sum, log) => sum + log.weighted_work, 0);
  const weightedMinutes = staffLogs.reduce((sum, log) => sum + (log.duration_minutes * log.category_weight * log.status_weight), 0);
  const avgCategoryWeight = logCount ? average(staffLogs.map((log) => log.category_weight)) : 0;
  const avgStatusWeight = logCount ? averageAll(staffLogs.map((log) => log.status_weight)) : 0;
  const successCount = staffLogs.filter((log) => log.status === "สำเร็จ").length;

  const workloadScore = maxima.weightedWork ? (weightedWork / maxima.weightedWork) * 25 : 0;
  const complexityScore = avgCategoryWeight ? (avgCategoryWeight / 1.3) * 20 : 0;
  const completionScore = clamp(avgStatusWeight, 0, 1) * 15;
  const durationScore = maxima.weightedMinutes ? (weightedMinutes / maxima.weightedMinutes) * 10 : 0;
  const quantityScore = clamp(workloadScore + complexityScore + completionScore + durationScore, 0, 70);

  const overallAverage = average(staffEvaluations.map((row) => row.overall_score));
  const dimensionAverage = average(staffEvaluations.flatMap((row) => QUALITY_FIELDS.map((field) => row[field])));
  const lowScoreCount = staffEvaluations.filter((row) => row.overall_score > 0 && row.overall_score <= 3).length;
  const lowRate = staffEvaluations.length ? lowScoreCount / staffEvaluations.length : 1;
  const riskScore = staffEvaluations.length ? 5 * (1 - lowRate) : 0;
  const qualityConfidence = Math.min(1, staffEvaluations.length / MIN_EVALUATIONS_FOR_FULL_CONFIDENCE);
  const rawQualityScore = (overallAverage / 5) * 15 + (dimensionAverage / 5) * 10 + riskScore;
  const qualityScore = clamp(rawQualityScore * qualityConfidence, 0, 30);
  const totalScore = quantityScore + qualityScore;

  return {
    staffName,
    logCount,
    totalMinutes,
    successCount,
    weightedWork,
    weightedMinutes,
    avgCategoryWeight,
    avgStatusWeight,
    workloadScore: clamp(workloadScore, 0, 25),
    complexityScore: clamp(complexityScore, 0, 20),
    completionScore: clamp(completionScore, 0, 15),
    durationScore: clamp(durationScore, 0, 10),
    quantityScore,
    evaluationCount: staffEvaluations.length,
    overallAverage,
    dimensionAverage,
    lowScoreCount,
    riskScore,
    qualityConfidence,
    rawQualityScore,
    qualityScore,
    totalScore,
  };
}

function calculateStaffScores(logs, evaluations) {
  const names = staffNamesForRows(logs, evaluations);
  const raw = names.map((name) => {
    const staffLogs = logs.filter((log) => log.staff_name === name);
    return {
      staffName: name,
      weightedWork: staffLogs.reduce((sum, log) => sum + log.weighted_work, 0),
      weightedMinutes: staffLogs.reduce((sum, log) => sum + (log.duration_minutes * log.category_weight * log.status_weight), 0),
    };
  });
  const maxima = {
    weightedWork: Math.max(...raw.map((row) => row.weightedWork), 0),
    weightedMinutes: Math.max(...raw.map((row) => row.weightedMinutes), 0),
  };
  return names
    .map((name) => scoreStaff(name, logs, evaluations, maxima))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function confidenceLabel(score) {
  if (score.evaluationCount >= MIN_EVALUATIONS_FOR_FULL_CONFIDENCE) return "เพียงพอ";
  if (score.evaluationCount > 0) return `ยังน้อย (${Math.round(score.qualityConfidence * 100)}%)`;
  return "ไม่มีแบบประเมิน";
}

function renderMetrics(scores, logs, evaluations) {
  const avgTotal = averageAll(scores.map((score) => score.totalScore));
  const avgQuantity = averageAll(scores.map((score) => score.quantityScore));
  const avgQuality = averageAll(scores.map((score) => score.qualityScore));
  const totalMinutes = logs.reduce((sum, log) => sum + log.duration_minutes, 0);
  const avgConfidence = scores.length ? scores.reduce((sum, score) => sum + score.qualityConfidence, 0) / scores.length : 0;

  elements.metricTotalScore.textContent = avgTotal.toFixed(2);
  elements.metricQuantityScore.textContent = avgQuantity.toFixed(2);
  elements.metricQualityScore.textContent = avgQuality.toFixed(2);
  elements.metricLogs.textContent = logs.length;
  elements.metricMinutes.textContent = durationLabel(totalMinutes);
  elements.metricEvaluations.textContent = evaluations.length;
  elements.metricConfidence.textContent = `ความเชื่อมั่น ${Math.round(avgConfidence * 100)}%`;
}

function renderStaffRows(scores) {
  if (!scores.length) {
    elements.staffRows.innerHTML = '<tr><td colspan="10"><div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.staffRows.innerHTML = scores.map((score) => `
    <tr>
      <td><strong>${escapeHtml(score.staffName)}</strong></td>
      <td><strong>${score.totalScore.toFixed(2)}</strong></td>
      <td>${score.quantityScore.toFixed(2)} / 70</td>
      <td>${score.qualityScore.toFixed(2)} / 30</td>
      <td>${score.logCount}</td>
      <td>${durationLabel(score.totalMinutes)}</td>
      <td>${score.successCount}</td>
      <td>${score.evaluationCount}</td>
      <td>${score.overallAverage ? score.overallAverage.toFixed(2) : "-"}</td>
      <td><span class="score-chip ${score.evaluationCount >= MIN_EVALUATIONS_FOR_FULL_CONFIDENCE ? "good" : "warn"}">${escapeHtml(confidenceLabel(score))}</span></td>
    </tr>
  `).join("");
}

function renderComponentList(container, scores, type) {
  const rows = scores.filter((score) => score.logCount || score.evaluationCount);
  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  container.innerHTML = rows.map((score) => {
    const items = type === "quantity"
      ? [
          ["ปริมาณงาน", score.workloadScore, 25],
          ["น้ำหนักหมวด", score.complexityScore, 20],
          ["ผลสำเร็จ", score.completionScore, 15],
          ["ระยะเวลา", score.durationScore, 10],
        ]
      : [
          ["คะแนนรวม", (score.overallAverage / 5) * 15 * score.qualityConfidence, 15],
          ["คะแนนรายด้าน", (score.dimensionAverage / 5) * 10 * score.qualityConfidence, 10],
          ["ความเสี่ยง", score.riskScore * score.qualityConfidence, 5],
        ];
    const total = type === "quantity" ? score.quantityScore : score.qualityScore;
    const max = type === "quantity" ? 70 : 30;
    return `
      <article class="dashboard-bar-row performance-score-row">
        <div class="dashboard-bar-head">
          <strong>${escapeHtml(score.staffName)}</strong>
          <span>${total.toFixed(2)} / ${max}</span>
        </div>
        <div class="dashboard-bar-track">
          <div class="dashboard-bar-fill ${type === "quality" ? "score-fill" : ""}" style="width:${Math.max(4, percent(total, max))}%"></div>
        </div>
        <div class="dashboard-status-line">
          ${items.map(([label, value, itemMax]) => `<span>${escapeHtml(label)} ${clamp(value, 0, itemMax).toFixed(2)}/${itemMax}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function renderCategoryList(logs, evaluations) {
  const categories = [...new Set([
    ...logs.map((row) => row.main_category),
    ...evaluations.map((row) => row.main_category),
  ].filter(Boolean))];
  const rows = categories.map((category) => {
    const categoryLogs = logs.filter((row) => row.main_category === category);
    const categoryEvaluations = evaluations.filter((row) => row.main_category === category);
    const minutes = categoryLogs.reduce((sum, row) => sum + row.duration_minutes, 0);
    const avgQuality = average(categoryEvaluations.map((row) => row.overall_score));
    return {
      category,
      count: categoryLogs.length,
      minutes,
      evaluations: categoryEvaluations.length,
      avgQuality,
    };
  }).sort((a, b) => b.minutes - a.minutes || b.evaluations - a.evaluations).slice(0, 12);

  if (!rows.length) {
    elements.categoryList.innerHTML = '<div class="empty-state">ไม่พบข้อมูลในช่วงเวลานี้</div>';
    return;
  }

  const maxMinutes = Math.max(...rows.map((row) => row.minutes), 1);
  elements.categoryList.innerHTML = rows.map((row) => `
    <article class="dashboard-bar-row">
      <div class="dashboard-bar-head">
        <strong>${escapeHtml(row.category)}</strong>
        <span>${row.count} งาน · ${durationLabel(row.minutes)}</span>
      </div>
      <div class="dashboard-bar-track">
        <div class="dashboard-bar-fill" style="width:${Math.max(4, percent(row.minutes, maxMinutes))}%"></div>
      </div>
      <div class="dashboard-status-line">
        <span>แบบประเมิน ${row.evaluations}</span>
        <span>คะแนนเฉลี่ย ${row.avgQuality ? row.avgQuality.toFixed(2) : "-"}</span>
      </div>
    </article>
  `).join("");
}

function renderFollowUps(scores) {
  const rows = scores
    .filter((score) => score.totalScore < 60 || score.qualityConfidence < 1 || score.lowScoreCount > 0)
    .sort((a, b) => a.totalScore - b.totalScore);

  if (!rows.length) {
    elements.followUpRows.innerHTML = '<tr><td colspan="3"><div class="empty-state">ไม่พบรายการที่ต้องติดตามในช่วงเวลานี้</div></td></tr>';
    return;
  }

  elements.followUpRows.innerHTML = rows.map((score) => {
    const issues = [];
    if (score.totalScore < 60) issues.push("คะแนนรวมต่ำกว่า 60");
    if (score.qualityConfidence < 1) issues.push("แบบประเมินยังไม่ถึง 5 รายการ");
    if (score.lowScoreCount > 0) issues.push(`มีคะแนนต่ำ ${score.lowScoreCount} รายการ`);
    return `
      <tr>
        <td><strong>${escapeHtml(score.staffName)}</strong></td>
        <td>${escapeHtml(issues.join(" / "))}</td>
        <td>${score.totalScore.toFixed(2)}</td>
      </tr>
    `;
  }).join("");
}

function renderDashboard() {
  const logs = filteredLogs();
  const evaluations = filteredEvaluations();
  const scores = calculateStaffScores(logs, evaluations);
  const from = elements.dateFrom.value ? isoToThaiShortDate(elements.dateFrom.value) : "-";
  const to = elements.dateTo.value ? isoToThaiShortDate(elements.dateTo.value) : "-";

  elements.performanceSubtitle.textContent = `ช่วงวันที่ ${from} ถึง ${to} · ${logs.length} รายการงาน · ${evaluations.length} แบบประเมิน`;
  renderMetrics(scores, logs, evaluations);
  renderStaffRows(scores);
  renderComponentList(elements.quantityList, scores, "quantity");
  renderComponentList(elements.qualityList, scores, "quality");
  renderCategoryList(logs, evaluations);
  renderFollowUps(scores);
}

async function loadDashboard() {
  elements.refreshPerformance.disabled = true;
  elements.performanceSubtitle.textContent = "กำลังโหลดข้อมูลจาก Google Sheet...";
  try {
    const data = await fetchData();
    allLogs = data.logs;
    allEvaluations = data.evaluations;
    populateCategoryFilter(allLogs, allEvaluations);
    if (!elements.dateFrom.value || !elements.dateTo.value) setDefaultDateRange(allLogs, allEvaluations);
    renderDashboard();
  } catch (error) {
    allLogs = [];
    allEvaluations = [];
    populateCategoryFilter([], []);
    elements.performanceSubtitle.textContent = error.message || "โหลดข้อมูลไม่สำเร็จ";
    renderDashboard();
  } finally {
    elements.refreshPerformance.disabled = false;
  }
}

elements.dateFrom.addEventListener("change", renderDashboard);
elements.dateTo.addEventListener("change", renderDashboard);
elements.staffFilter.addEventListener("change", renderDashboard);
elements.categoryFilter.addEventListener("change", renderDashboard);
elements.refreshPerformance.addEventListener("click", loadDashboard);

loadDashboard();
