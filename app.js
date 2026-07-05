const STORAGE_KEY = "it-support-daily-work-logs";
const SCRIPT_URL_KEY = "it-support-google-script-url";

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
  scriptUrl: document.querySelector("#scriptUrl"),
  saveScriptUrl: document.querySelector("#saveScriptUrl"),
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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
  return localStorage.getItem(SCRIPT_URL_KEY) || "";
}

function saveScriptUrl() {
  const url = elements.scriptUrl.value.trim();
  if (!url) {
    localStorage.removeItem(SCRIPT_URL_KEY);
    showToast("ลบ Apps Script URL แล้ว");
    return;
  }
  if (!url.startsWith("https://script.google.com/")) {
    showToast("URL ควรเป็น Web app URL จาก script.google.com");
    return;
  }
  localStorage.setItem(SCRIPT_URL_KEY, url);
  showToast("บันทึก Apps Script URL แล้ว");
}

function makeId(date) {
  const compactDate = date.replaceAll("-", "");
  const serial = String(loadLogs().filter((log) => log.work_date === date).length + 1).padStart(4, "0");
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
  const minutes = minutesBetween(elements.startTime.value, elements.endTime.value);
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
    .sort((a, b) => `${b.work_date} ${b.start_time}`.localeCompare(`${a.work_date} ${a.start_time}`));
}

function renderSummary() {
  const date = elements.workDate.value || today();
  const todayLogs = loadLogs().filter((log) => log.work_date === date);
  elements.summaryDate.textContent = date;
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
          <td>${escapeHtml(log.work_date)}</td>
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
  const dateValue = keepDate ? elements.workDate.value || today() : today();
  elements.form.reset();
  elements.workDate.value = dateValue;
  elements.startTime.value = nowTime();
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
  const staff = staffList.find((item) => item.name === elements.staff.value);
  const durationMinutes = minutesBetween(elements.startTime.value, elements.endTime.value);
  const files = Array.from(elements.attachments.files || []).map((file) => file.name);
  return {
    log_id: editId || makeId(elements.workDate.value),
    work_date: elements.workDate.value,
    staff_name: staff?.name || elements.staff.value,
    staff_email: staff?.email || "",
    start_time: elements.startTime.value,
    end_time: elements.endTime.value,
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
    return { ok: false, skipped: true, message: "ยังไม่ได้ตั้งค่า Apps Script URL" };
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
  elements.workDate.value = log.work_date;
  elements.staff.value = log.staff_name;
  elements.startTime.value = log.start_time;
  elements.endTime.value = log.end_time || "";
  elements.mainCategory.value = log.main_category;
  updateSubCategories();
  elements.subCategory.value = log.sub_category;
  elements.status.value = log.status;
  elements.workTitle.value = log.work_title;
  elements.workDetail.value = log.work_detail;
  elements.resultNote.value = log.result_note || "";
  elements.detailCount.textContent = String(elements.workDetail.value.length);
  updateDuration();
  elements.formMode.textContent = `แก้ไข ${log.log_id}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submitForm(event) {
  event.preventDefault();
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
    showToast("บันทึก local แล้ว แต่ยังไม่ได้ตั้งค่า Apps Script URL");
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
  saveLogs([
    {
      log_id: makeId(date),
      work_date: date,
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
      work_date: date,
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
  elements.workDate.addEventListener("change", renderSummary);
  elements.mainCategory.addEventListener("change", updateSubCategories);
  elements.workDetail.addEventListener("input", () => {
    elements.detailCount.textContent = String(elements.workDetail.value.length);
  });
  elements.form.addEventListener("submit", submitForm);
  elements.resetForm.addEventListener("click", () => resetForm());
  elements.searchText.addEventListener("input", renderTable);
  elements.filterStatus.addEventListener("change", renderTable);
  elements.saveScriptUrl.addEventListener("click", saveScriptUrl);
  elements.clearToday.addEventListener("click", () => {
    const date = elements.workDate.value || today();
    saveLogs(loadLogs().filter((log) => log.work_date !== date));
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
  elements.scriptUrl.value = getScriptUrl();
  elements.workDate.value = today();
  elements.startTime.value = nowTime();
  updateSubCategories();
  bindEvents();
  seedIfEmpty();
  renderAll();
}

init();
