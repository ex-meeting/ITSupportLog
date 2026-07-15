const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby1q74q3Tb_8v7WwNdZNEQcPz3REdBfHXEuDNzb0_9OpsoRS8zjE4ppXkoRfWgyM8FlLg/exec";
const pageParams = new URLSearchParams(window.location.search);
const linkedLogId = getLinkedLogId();

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
  "งานประชุม/ประสานงาน/โครงการ/นโยบาย/อื่น ๆ": [
    "งานนวัตกรรมเพื่อพัฒนางาน",
    "ปรับปรุงกระบวนการ",
    "งานตามนโยบายคณะ",
    "พัฒนาระบบหรือรายงาน",
    "ประชุมทีม",
    "ประสานงานหน่วยงาน",
    "งานเร่งด่วน",
    "อื่น ๆ",
  ],
};

const ratingItems = [
  { key: "speed_score", label: "ความรวดเร็วในการให้บริการ" },
  { key: "communication_score", label: "ความสุภาพและการสื่อสาร" },
  { key: "technical_score", label: "ความรู้ความสามารถในการแก้ปัญหา" },
  { key: "clarity_score", label: "ความชัดเจนของคำแนะนำ/การอธิบาย" },
  { key: "outcome_score", label: "ผลลัพธ์ของการให้บริการ" },
  { key: "overall_score", label: "ความพึงพอใจโดยรวม" },
];

const elements = {
  form: document.querySelector("#satisfaction-form"),
  logId: document.querySelector("#logId"),
  serviceRefStatus: document.querySelector("#serviceRefStatus"),
  recipientName: document.querySelector("#recipientName"),
  department: document.querySelector("#department"),
  recipientType: document.querySelector("#recipientType"),
  contact: document.querySelector("#contact"),
  serviceDate: document.querySelector("#serviceDate"),
  endTime: document.querySelector("#endTime"),
  staffName: document.querySelector("#staffName"),
  serviceChannel: document.querySelector("#serviceChannel"),
  mainCategory: document.querySelector("#mainCategory"),
  subCategory: document.querySelector("#subCategory"),
  workTitle: document.querySelector("#workTitle"),
  serviceStatus: document.querySelector("#serviceStatus"),
  suggestion: document.querySelector("#suggestion"),
  ratingSection: document.querySelector("#ratingSection"),
  submitButton: document.querySelector("#submitButton"),
  toast: document.querySelector("#toast"),
};

let linkedLogReady = false;

function init() {
  renderRatingItems();
  elements.logId.value = linkedLogId;
  setSubmitLocked(true);
  loadLinkedLog();
  elements.form.addEventListener("submit", handleSubmit);
  elements.form.addEventListener("reset", () => {
    window.setTimeout(() => {
      loadLinkedLog();
    }, 0);
  });
}

function renderCategoryOptions() {
  elements.mainCategory.innerHTML = Object.keys(categoryMap)
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  renderSubCategoryOptions();
}

function renderSubCategoryOptions() {
  const category = elements.mainCategory.value;
  const subCategories = categoryMap[category] || [];
  elements.subCategory.innerHTML = subCategories
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
}

function renderRatingItems() {
  elements.ratingSection.innerHTML = ratingItems.map((item) => {
    const scores = [1, 2, 3, 4, 5].map((score) => `
      <label class="rating-option">
        <input type="radio" name="${item.key}" value="${score}" required />
        <span>${score}</span>
      </label>
    `).join("");

    return `
      <div class="rating-row">
        <div class="rating-label">${escapeHtml(item.label)}</div>
        <div class="rating-options" aria-label="${escapeHtml(item.label)}">${scores}</div>
      </div>
    `;
  }).join("");
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!elements.form.reportValidity()) return;

  const payload = collectPayload();
  setSubmitting(true);
  try {
    await submitPayload(payload);
    elements.form.reset();
    loadLinkedLog();
    showToast("ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณครับ");
  } catch (error) {
    showToast(`ส่งข้อมูลไม่สำเร็จ: ${error.message}`);
  } finally {
    setSubmitting(false);
  }
}

async function loadLinkedLog() {
  elements.logId.value = linkedLogId;
  linkedLogReady = false;
  if (!linkedLogId) {
    clearLinkedLogFields();
    setServiceRefStatus("ยังไม่พบ log_id ใน URL จึงไม่สามารถดึงรายการงานได้ กรุณาเปิดลิงก์แบบ satisfaction.html?v=20260715-02&log_id=LOG-...");
    setSubmitLocked(true);
    return;
  }

  setServiceRefStatus("กำลังโหลดข้อมูลงานจาก Google Sheet...");
  setSubmitLocked(true);
  try {
    const data = await jsonpRequest(GOOGLE_SCRIPT_URL, {
      action: "log_ref",
      log_id: linkedLogId,
    });
    if (!data.ok || !data.log) {
      throw new Error(data.error || "ไม่พบรายการงานตามรหัสนี้");
    }
    applyLinkedLog(data.log);
    linkedLogReady = true;
    setServiceRefStatus("ดึงข้อมูลงานเรียบร้อยแล้ว");
    setSubmitLocked(false);
  } catch (error) {
    linkedLogReady = false;
    clearLinkedLogFields();
    setServiceRefStatus(error.message || "โหลดข้อมูลงานไม่สำเร็จ");
    setSubmitLocked(true);
  }
}

function getLinkedLogId() {
  return String(
    pageParams.get("log_id") ||
    pageParams.get("logId") ||
    pageParams.get("id") ||
    pageParams.get("ref") ||
    ""
  ).trim();
}

function applyLinkedLog(log) {
  elements.logId.value = log.log_id || linkedLogId;
  elements.serviceDate.value = normalizeIsoDate(log.work_date_iso || log.work_date);
  elements.endTime.value = normalizeTime(log.end_time || "");
  elements.staffName.value = log.staff_name || "";
  elements.mainCategory.value = log.main_category || "";
  elements.subCategory.value = log.sub_category || "";
  elements.workTitle.value = log.work_title || "";
  elements.serviceStatus.value = log.status || "";
}

function clearLinkedLogFields() {
  elements.serviceDate.value = "";
  elements.endTime.value = "";
  elements.staffName.value = "";
  elements.mainCategory.value = "";
  elements.subCategory.value = "";
  elements.workTitle.value = "";
  elements.serviceStatus.value = "";
}

function setServiceRefStatus(message) {
  elements.serviceRefStatus.textContent = message;
}

function collectPayload() {
  return {
    form_type: "satisfaction",
    response_id: makeResponseId(),
    log_id: linkedLogId,
    submitted_at: new Date().toISOString(),
    recipient_name: elements.recipientName.value.trim(),
    department: elements.department.value.trim(),
    recipient_type: elements.recipientType.value,
    contact: elements.contact.value.trim(),
    service_date: elements.serviceDate.value,
    end_time: elements.endTime.value,
    staff_name: elements.staffName.value,
    service_channel: elements.serviceChannel.value,
    main_category: elements.mainCategory.value,
    sub_category: elements.subCategory.value,
    work_title: elements.workTitle.value.trim(),
    service_status: elements.serviceStatus.value,
    suggestion: elements.suggestion.value.trim(),
    source_page: window.location.pathname.split("/").pop() || "satisfaction.html",
    ...collectRatings(),
  };
}

function jsonpRequest(baseUrl, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `itSupportSatisfactionCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, value);
    });
    url.searchParams.set("callback", callbackName);

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("โหลดข้อมูลงานจาก Google Sheet ไม่สำเร็จ"));
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
      reject(new Error("โหลดข้อมูลงานจาก Google Sheet ไม่สำเร็จ"));
    };
    script.src = url.toString();
    document.body.append(script);
  });
}

function setSubmitLocked(isLocked) {
  elements.submitButton.disabled = isLocked;
}

function collectRatings() {
  return ratingItems.reduce((acc, item) => {
    const selected = elements.form.querySelector(`input[name="${item.key}"]:checked`);
    acc[item.key] = selected ? Number(selected.value) : "";
    return acc;
  }, {});
}

async function submitPayload(payload) {
  if (!GOOGLE_SCRIPT_URL) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_SCRIPT_URL");
  await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function setSubmitting(isSubmitting) {
  elements.submitButton.disabled = isSubmitting || !linkedLogReady;
  elements.submitButton.textContent = isSubmitting ? "กำลังส่งข้อมูล..." : "ส่งแบบประเมิน";
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const compact = text.replace(/[^\d]/g, "");
  if (/^\d{1,2}$/.test(compact)) {
    const hour = Number(compact);
    return hour >= 0 && hour <= 23 ? `${String(hour).padStart(2, "0")}:00` : text;
  }
  if (/^\d{3,4}$/.test(compact)) {
    const hour = Number(compact.slice(0, -2));
    const minute = Number(compact.slice(-2));
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }
  return text;
}

function normalizeIsoDate(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const thaiMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (thaiMatch) {
    const day = thaiMatch[1].padStart(2, "0");
    const month = thaiMatch[2].padStart(2, "0");
    let year = Number(thaiMatch[3]);
    if (year < 100) year += 2500;
    if (year > 2400) year -= 543;
    return `${year}-${month}-${day}`;
  }
  return "";
}

function makeResponseId() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = Date.now().toString(36).toUpperCase().slice(-8);
  return `SAT-${ymd}-${suffix}`;
}

function getTodayIsoDate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
