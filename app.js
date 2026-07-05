const STORAGE_KEY = "it-support-daily-work-logs";
const SCRIPT_URL_KEY = "it-support-google-script-url";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby1q74q3Tb_8v7WwNdZNEQcPz3REdBfHXEuDNzb0_9OpsoRS8zjE4ppXkoRfWgyM8FlLg/exec";

const staffList = [
  { name: "นายมนตรี กิ่งแก้ว", email: "montree@example.local", role: "Supervisor" },
  { name: "จสอ.ธนบดี ข่ายม่าน", email: "tanabodee@example.local", role: "Staff" },
  { name: "นายสมพงษ์ แสนชา", email: "somphong@example.local", role: "Staff" },
];

const categoryMap = {
  "งานสนับสนุนห้องเรียนและห้องปฏิบัติการ": [
    "ติดตั้งระบบปฏิบัติการบนเครื่องคอมพิวเตอร์",
    "ติดตั้งซอฟต์แวร์การเรียนการสอน",
    "สร้าง Master image",
    "ติดตั้งระบบ Multimedia",
    "ตรวจสอบความพร้อมอุปกรณ์สื่อการสอน",
    "แก้ปัญหาอุปกรณ์สื่อการสอน",
    "อื่น ๆ",
  ],
  "งานซ่อมบำรุงและดูแลอุปกรณ์": [
    "เครื่องคอมพิวเตอร์",
    "เครื่องโปรเจกเตอร์",
    "เครื่องปรินเตอร์",
    "เครื่องสำรองไฟฟ้า",
    "ระบบปรับอากาศ",
    "อื่น ๆ",
  ],
  "งานบริการผู้ใช้และ Help Desk ภายใน": [
    "ช่วยเหลือผู้ใช้",
    "ติดตั้งโปรแกรม",
    "แก้ปัญหาการใช้งาน",
    "ยืม/คืนทรัพยากรสารสนเทศ",
    "ประสานงานบริการ",
    "อื่น ๆ",
  ],
  "งานเครือข่ายและโครงสร้างพื้นฐาน": [
    "ตรวจสอบระบบเครือข่าย",
    "ติดตั้งระบบเครือข่าย",
    "ทำความสะอาดตู้ Distribution Rack",
    "จัดการหมายเลข IP",
    "จัดการ DNS",
    "Internet/Wi-Fi",
    "อื่น ๆ",
  ],
  "งานระบบสารสนเทศ บัญชีผู้ใช้ และความปลอดภัย": [
    "จัดการบัญชีผู้ใช้ระบบ",
    "จัดการสิทธิ์บริการเครื่องพิมพ์",
    "จัดการรายวิชาในระบบ Onlearn",
    "จัดการ VM และ Cloud services",
    "ตรวจสอบความปลอดภัยเบื้องต้น",
    "อื่น ๆ",
  ],
  "งานเอกสารและงานบริหารจัดการทรัพยากร": [
    "เอกสารจัดซื้อจัดจ้าง",
    "Password list",
    "ทะเบียนทรัพยากร",
    "ข้อมูลนักศึกษาพ้นสภาพ",
    "รายการครุภัณฑ์",
    "อื่น ๆ",
  ],
  "งานโครงการ/นโยบาย/พัฒนางาน": [
    "งานนวัตกรรมเพื่อพัฒนางาน",
    "ปรับปรุงกระบวนการ",
    "งานตามนโยบายคณะ",
    "พัฒนาระบบหรือรายงาน",
    "อื่น ๆ",
  ],
  "งานประชุม/ประสานงาน/อื่น ๆ": [
    "ประชุมทีม",
    "ประสานงานหน่วยงาน",
    "งานเร่งด่วน",
    "อื่น ๆ",
  ],
};

const elements = {
  form: document.querySelector("#daily-form"),
  formMode: document.querySelector("#formMode"),
  workDate: document.querySelector("#workDate"),
  openCalendar: document.querySelector("#openCalendar"),
  thaiCalendar: document.querySelector("#thaiCalendar"),
  thaiDatePreview: document.querySelector("#thaiDatePreview"),
  staff: document.querySelector("#staff"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  duration: document.querySelector("#duration"),
  mainCategory: document.querySelector("#mainCategory"),
  subCategory: document.querySelector("#subCategory"),
  status: document.querySelector("#status"),
  workTitle: document.querySelector("#workTitle"),
  workDetail: document.querySelector("#workDetail"),
  detailCount: document.querySelector("#detailCount"),
  resultNote: document.querySelector("#resultNote"),
  attachments: document.querySelector("#attachments"),
  resetForm: document.querySelector("#resetForm"),
  clearToday: document.querySelector("#clearToday"),
  summaryDate: document.querySelector("#summaryDate"),
  countAll: document.querySelector("#countAll"),
  countDone: document.querySelector("#countDone"),
  countDoing: document.querySelector("#countDoing"),
  countFailed: document.querySelector("#countFailed"),
  recentList: document.querySelector("#recentList"),
  logRows: document.querySelector("#logRows"),
  searchText: document.querySelector("#searchText"),
  filterStatus: document.querySelector("#filterStatus"),
  toast: document.querySelector("#toast"),
};

let editId = null;
let calendarCursor = null;

const thaiMonthNames = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const thaiWeekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

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

function normalizeDateInput() {
  const iso = thaiDateToIso(elements.workDate.value);
  if (!iso) return "";
  elements.workDate.value = isoToThaiShortDate(iso);
  updateThaiDatePreview();
  return iso;
}

function updateThaiDatePreview() {
  const iso = thaiDateToIso(elements.workDate.value);
  elements.thaiDatePreview.textContent = iso ? `วันที่ไทย: ${isoToThaiDate(iso)}` : "กรุณาเลือกวันที่จากปฏิทิน";
}

function dateFromIso(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function openCalendar() {
  const iso = thaiDateToIso(elements.workDate.value) || today();
  calendarCursor = dateFromIso(iso);
  renderCalendar();
  elements.thaiCalendar.hidden = false;
}

function closeCalendar() {
  elements.thaiCalendar.hidden = true;
}

function changeCalendarMonth(delta) {
  calendarCursor = calendarCursor || dateFromIso(today());
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
  renderCalendar();
}

function selectCalendarDate(isoDate) {
  elements.workDate.value = isoToThaiShortDate(isoDate);
  calendarCursor = dateFromIso(isoDate);
  updateThaiDatePreview();
  renderSummary();
  closeCalendar();
}

function renderCalendar() {
  const cursor = calendarCursor || dateFromIso(today());
  const selectedIso = thaiDateToIso(elements.workDate.value);
  const todayIso = today();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const startDate = new Date(year, month, 1 - startOffset);
  const title = `${thaiMonthNames[month]} ${year + 543}`;

  const dayButtons = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const iso = isoFromDate(date);
    const classes = [
      "calendar-day",
      date.getMonth() !== month ? "muted" : "",
      iso === todayIso ? "today" : "",
      iso === selectedIso ? "selected" : "",
    ]
      .filter(Boolean)
      .join(" ");
    dayButtons.push(`<button class="${classes}" type="button" data-date="${iso}">${date.getDate()}</button>`);
  }

  elements.thaiCalendar.innerHTML = `
    <div class="calendar-head">
      <button class="calendar-nav" type="button" data-calendar-nav="-1" aria-label="เดือนก่อนหน้า">‹</button>
      <div class="calendar-title">${title}</div>
      <button class="calendar-nav" type="button" data-calendar-nav="1" aria-label="เดือนถัดไป">›</button>
    </div>
    <div class="calendar-grid">
      ${thaiWeekdays.map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
      ${dayButtons.join("")}
    </div>
  `;
}

function getLogIsoDate(log) {
  return log.work_date_iso || thaiDateToIso(log.work_date) || log.work_date;
}

function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function normalizeTime(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeInput(input) {
  const normalized = normalizeTime(input.value);
  if (normalized) input.value = normalized;
  updateDuration();
}

function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

function getScriptUrl() {
  return GOOGLE_SCRIPT_URL || localStorage.getItem(SCRIPT_URL_KEY) || "";
}

function makeId(date) {
  const isoDate = thaiDateToIso(date) || date;
  const compactDate = isoDate.replaceAll("-", "");
  const serial = String(loadLogs().filter((log) => getLogIsoDate(log) === isoDate).length + 1).padStart(4, "0");
  return `LOG-${compactDate}-${serial}`;
}

function renderOptions(select, values, placeholder) {
  select.innerHTML = "";
  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.append(option);
  }
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

function durationLabel(minutes) {
  if (minutes === null || Number.isNaN(minutes)) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ชม. ${m} นาที`;
  if (h) return `${h} ชม.`;
  return `${m} นาที`;
}

function updateDuration() {
  const minutes = minutesBetween(normalizeTime(elements.startTime.value), normalizeTime(elements.endTime.value));
  elements.duration.value = durationLabel(minutes);
}

function updateSubCategories() {
  const selected = elements.mainCategory.value;
  renderOptions(elements.subCategory, categoryMap[selected] || [], "เลือกประเภทย่อย");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function statusClass(status) {
  return `status-pill status-${status}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFilteredLogs() {
  const text = elements.searchText.value.trim().toLowerCase();
  const status = elements.filterStatus.value;
  return loadLogs()
    .filter((log) => !status || log.status === status)
    .filter((log) => {
      if (!text) return true;
      return [log.work_title, log.work_detail, log.main_category, log.sub_category, log.staff_name]
        .join(" ")
        .toLowerCase()
        .includes(text);
    })
    .sort((a, b) => `${getLogIsoDate(b)} ${b.start_time}`.localeCompare(`${getLogIsoDate(a)} ${a.start_time}`));
}

function renderSummary() {
  const date = thaiDateToIso(elements.workDate.value) || today();
  const todayLogs = loadLogs().filter((log) => getLogIsoDate(log) === date);
  elements.summaryDate.textContent = isoToThaiDate(date);
  elements.countAll.textContent = todayLogs.length;
  elements.countDone.textContent = todayLogs.filter((log) => log.status === "สำเร็จ").length;
  elements.countDoing.textContent = todayLogs.filter((log) => log.status === "ระหว่างดำเนินการ").length;
  elements.countFailed.textContent = todayLogs.filter((log) => log.status === "ไม่สำเร็จ").length;

  const recent = todayLogs
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, 8);

  if (!recent.length) {
    elements.recentList.innerHTML = '<div class="empty-state">ยังไม่มีรายการของวันที่เลือก</div>';
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
          <p>${escapeHtml(log.start_time)}${log.end_time ? `-${escapeHtml(log.end_time)}` : ""} · ${escapeHtml(log.staff_name)}</p>
          <p>${escapeHtml(log.main_category)}</p>
        </article>
      `,
    )
    .join("");
}

function renderTable() {
  const logs = getFilteredLogs();
  if (!logs.length) {
    elements.logRows.innerHTML = '<tr><td colspan="7"><div class="empty-state">ไม่พบข้อมูลตามเงื่อนไข</div></td></tr>';
    return;
  }

  elements.logRows.innerHTML = logs
    .map(
      (log) => `
        <tr>
          <td>${escapeHtml(isoToThaiDate(getLogIsoDate(log)))}</td>
          <td>${escapeHtml(log.start_time)}${log.end_time ? `-${escapeHtml(log.end_time)}` : ""}<br><small>${durationLabel(log.duration_minutes)}</small></td>
          <td>${escapeHtml(log.staff_name)}<br><small>${escapeHtml(log.staff_email)}</small></td>
          <td><strong>${escapeHtml(log.work_title)}</strong><br><small>${escapeHtml(log.work_detail).slice(0, 90)}</small></td>
          <td>${escapeHtml(log.main_category)}<br><small>${escapeHtml(log.sub_category)}</small></td>
          <td><span class="${statusClass(log.status)}">${escapeHtml(log.status)}</span></td>
          <td>
            <div class="row-actions">
              <button class="mini-button" type="button" data-action="edit" data-id="${escapeHtml(log.log_id)}">แก้ไข</button>
              <button class="mini-button delete" type="button" data-action="delete" data-id="${escapeHtml(log.log_id)}">ลบ</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");
}

function renderAll() {
  renderSummary();
  renderTable();
}

function resetForm(keepDate = true) {
  const dateValue = keepDate ? thaiDateToIso(elements.workDate.value) || today() : today();
  elements.form.reset();
  elements.workDate.value = isoToThaiShortDate(dateValue);
  elements.startTime.value = nowTime();
  updateThaiDatePreview();
  elements.mainCategory.selectedIndex = 0;
  updateSubCategories();
  elements.duration.value = "-";
  elements.detailCount.textContent = "0";
  editId = null;
  elements.formMode.textContent = "รายการใหม่";
}

function validateByStatus(status, endTime, resultNote) {
  if ((status === "สำเร็จ" || status === "ไม่สำเร็จ") && !endTime) {
    return "สถานะสำเร็จ/ไม่สำเร็จควรระบุเวลาเสร็จ";
  }
  if ((status === "ไม่สำเร็จ" || status === "ต่อเนื่องวันถัดไป") && !resultNote.trim()) {
    return "กรุณาระบุผลการดำเนินงานหรือสิ่งที่ต้องติดตาม";
  }
  return "";
}

function collectFormData() {
  const isoDate = normalizeDateInput();
  const staff = staffList.find((item) => item.name === elements.staff.value);
  const startTime = normalizeTime(elements.startTime.value);
  const endTime = normalizeTime(elements.endTime.value);
  const durationMinutes = minutesBetween(startTime, endTime);
  const files = Array.from(elements.attachments.files || []).map((file) => file.name);
  return {
    log_id: editId || makeId(isoDate),
    work_date: isoToThaiShortDate(isoDate),
    work_date_iso: isoDate,
    staff_name: staff?.name || elements.staff.value,
    staff_email: staff?.email || "",
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    main_category: elements.mainCategory.value,
    sub_category: elements.subCategory.value,
    work_title: elements.workTitle.value.trim(),
    work_detail: elements.workDetail.value.trim(),
    status: elements.status.value,
    result_note: elements.resultNote.value.trim(),
    attachment_names: files,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function sendToGoogleSheet(data) {
  const url = getScriptUrl();
  if (!url) {
    return { ok: false, skipped: true, message: "ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL ใน app.js" };
  }

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(data),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function fillForm(log) {
  editId = log.log_id;
  elements.workDate.value = isoToThaiShortDate(getLogIsoDate(log));
  elements.staff.value = log.staff_name;
  elements.startTime.value = normalizeTime(log.start_time);
  elements.endTime.value = normalizeTime(log.end_time) || "";
  elements.mainCategory.value = log.main_category;
  updateSubCategories();
  elements.subCategory.value = log.sub_category;
  elements.status.value = log.status;
  elements.workTitle.value = log.work_title;
  elements.workDetail.value = log.work_detail;
  elements.resultNote.value = log.result_note || "";
  elements.detailCount.textContent = String(elements.workDetail.value.length);
  updateThaiDatePreview();
  updateDuration();
  elements.formMode.textContent = `แก้ไข ${log.log_id}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitForm(event) {
  event.preventDefault();
  if (!thaiDateToIso(elements.workDate.value)) {
    showToast("กรุณากรอกวันที่รูปแบบ วว/ดด/ปป หรือเลือกจากปฏิทิน");
    return;
  }
  formatTimeInput(elements.startTime);
  formatTimeInput(elements.endTime);
  if (!normalizeTime(elements.startTime.value)) {
    showToast("กรุณากรอกเวลาเริ่มเป็นรูปแบบ 24 ชั่วโมง เช่น 09:00");
    return;
  }
  if (elements.endTime.value && !normalizeTime(elements.endTime.value)) {
    showToast("กรุณากรอกเวลาเสร็จเป็นรูปแบบ 24 ชั่วโมง เช่น 17:30");
    return;
  }
  const data = collectFormData();
  const error = validateByStatus(data.status, data.end_time, data.result_note);
  if (error) {
    showToast(error);
    return;
  }

  const logs = loadLogs();
  const existingIndex = logs.findIndex((log) => log.log_id === data.log_id);
  if (existingIndex >= 0) {
    data.created_at = logs[existingIndex].created_at;
    logs[existingIndex] = data;
  } else {
    logs.push(data);
  }
  saveLogs(logs);
  const sheetResult = await sendToGoogleSheet(data);
  renderAll();
  resetForm();
  if (sheetResult.ok) {
    showToast(existingIndex >= 0 ? "แก้ไขรายการ local และส่งเข้า Google Sheet แล้ว" : "บันทึกและส่งเข้า Google Sheet แล้ว");
  } else if (sheetResult.skipped) {
    showToast("บันทึก local แล้ว แต่ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL ใน app.js");
  } else {
    showToast(`บันทึก local แล้ว แต่ส่งเข้า Sheet ไม่สำเร็จ: ${sheetResult.message}`);
  }
}

function deleteLog(id) {
  const logs = loadLogs().filter((log) => log.log_id !== id);
  saveLogs(logs);
  renderAll();
  if (editId === id) resetForm();
  showToast("ลบรายการแล้ว");
}

function seedIfEmpty() {
  if (loadLogs().length) return;
  const date = today();
  const thaiDate = isoToThaiShortDate(date);
  saveLogs([
    {
      log_id: makeId(date),
      work_date: thaiDate,
      work_date_iso: date,
      staff_name: staffList[0].name,
      staff_email: staffList[0].email,
      start_time: "09:00",
      end_time: "09:35",
      duration_minutes: 35,
      main_category: "งานเครือข่ายและโครงสร้างพื้นฐาน",
      sub_category: "ตรวจสอบระบบเครือข่าย",
      work_title: "ตรวจสอบ Internet ห้องประชุม",
      work_detail: "ตรวจสอบอุปกรณ์เครือข่ายและทดสอบการเชื่อมต่อหลังมีรายงานว่าสัญญาณไม่เสถียร",
      status: "สำเร็จ",
      result_note: "ใช้งานได้ปกติหลัง reboot access point",
      attachment_names: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      log_id: `LOG-${date.replaceAll("-", "")}-0002`,
      work_date: thaiDate,
      work_date_iso: date,
      staff_name: staffList[1].name,
      staff_email: staffList[1].email,
      start_time: "10:15",
      end_time: "",
      duration_minutes: null,
      main_category: "งานระบบสารสนเทศ บัญชีผู้ใช้ และความปลอดภัย",
      sub_category: "จัดการบัญชีผู้ใช้ระบบ",
      work_title: "ตรวจสอบสิทธิ์เข้าใช้งานระบบ Onlearn",
      work_detail: "ตรวจสอบบัญชีผู้ใช้และกลุ่มสิทธิ์ของรายวิชาที่เปิดสอนภาคปัจจุบัน",
      status: "ระหว่างดำเนินการ",
      result_note: "",
      attachment_names: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
}

function bindEvents() {
  elements.startTime.addEventListener("input", updateDuration);
  elements.endTime.addEventListener("input", updateDuration);
  elements.startTime.addEventListener("blur", () => formatTimeInput(elements.startTime));
  elements.endTime.addEventListener("blur", () => formatTimeInput(elements.endTime));
  elements.workDate.addEventListener("change", () => {
    normalizeDateInput();
    renderSummary();
  });
  elements.workDate.addEventListener("blur", () => {
    normalizeDateInput();
    renderSummary();
  });
  elements.openCalendar.addEventListener("click", openCalendar);
  elements.thaiCalendar.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-calendar-nav]");
    if (nav) {
      changeCalendarMonth(Number(nav.dataset.calendarNav));
      return;
    }
    const day = event.target.closest("[data-date]");
    if (day) selectCalendarDate(day.dataset.date);
  });
  document.addEventListener("click", (event) => {
    if (
      elements.thaiCalendar.hidden ||
      elements.thaiCalendar.contains(event.target) ||
      elements.openCalendar.contains(event.target) ||
      elements.workDate.contains(event.target)
    ) {
      return;
    }
    closeCalendar();
  });
  elements.mainCategory.addEventListener("change", updateSubCategories);
  elements.workDetail.addEventListener("input", () => {
    elements.detailCount.textContent = String(elements.workDetail.value.length);
  });
  elements.form.addEventListener("submit", submitForm);
  elements.resetForm.addEventListener("click", () => resetForm());
  elements.searchText.addEventListener("input", renderTable);
  elements.filterStatus.addEventListener("change", renderTable);
  elements.clearToday.addEventListener("click", () => {
    const date = thaiDateToIso(elements.workDate.value) || today();
    saveLogs(loadLogs().filter((log) => getLogIsoDate(log) !== date));
    renderAll();
    showToast("ล้างรายการของวันที่เลือกแล้ว");
  });
  elements.logRows.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit") {
      const log = loadLogs().find((item) => item.log_id === id);
      if (log) fillForm(log);
    }
    if (button.dataset.action === "delete") {
      deleteLog(id);
    }
  });
}

function init() {
  renderOptions(elements.staff, staffList.map((staff) => staff.name), "เลือกเจ้าหน้าที่");
  renderOptions(elements.mainCategory, Object.keys(categoryMap), "เลือกหมวดงานหลัก");
  elements.workDate.value = isoToThaiShortDate(today());
  elements.startTime.value = nowTime();
  updateThaiDatePreview();
  updateSubCategories();
  bindEvents();
  seedIfEmpty();
  renderAll();
}

init();
