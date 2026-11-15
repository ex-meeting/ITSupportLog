(function () {
  "use strict";

  const STORAGE_KEY = "it-support-manager-token";
  let pendingRequest = null;

  function cleanLegacyTokenFromUrl() {
    const url = new URL(window.location.href);
    const token = String(url.searchParams.get("token") || "").trim();
    if (!token) return "";
    sessionStorage.setItem(STORAGE_KEY, token);
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return token;
  }

  function storedToken() {
    return String(sessionStorage.getItem(STORAGE_KEY) || "").trim();
  }

  function mountChangeButton() {
    if (document.querySelector("#managerAuthChange")) return;
    const heading = document.querySelector(".dashboard-filter-panel .panel-heading");
    const button = document.createElement("button");
    button.id = "managerAuthChange";
    button.className = "ghost-button manager-auth-change";
    button.type = "button";
    button.textContent = "เปลี่ยนรหัสผู้บริหาร";
    button.addEventListener("click", () => {
      sessionStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });
    if (!heading) {
      document.body.append(button);
      return;
    }

    let actions = heading.querySelector(".manager-auth-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "manager-auth-actions";
      const existingButton = heading.querySelector(":scope > button");
      if (existingButton) actions.append(existingButton);
      heading.append(actions);
    }
    actions.append(button);
  }

  function requestToken(message = "") {
    if (pendingRequest) return pendingRequest;

    pendingRequest = new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop manager-auth-backdrop";
      backdrop.innerHTML = `
        <section class="confirm-modal manager-auth-modal" role="dialog" aria-modal="true" aria-labelledby="managerAuthTitle">
          <div class="modal-head">
            <p class="section-label">พื้นที่สำหรับผู้บริหาร</p>
            <h2 id="managerAuthTitle">เข้าสู่ Dashboard</h2>
            <p>กรอกรหัสผู้บริหารเพื่อโหลดข้อมูล รายการนี้จะเก็บเฉพาะในแท็บปัจจุบัน</p>
          </div>
          <form id="managerAuthForm" class="manager-auth-form">
            <label>
              รหัสผู้บริหาร
              <input id="managerAuthToken" type="password" autocomplete="off" spellcheck="false" required />
            </label>
            <p class="form-error manager-auth-error" id="managerAuthError" ${message ? "" : "hidden"}>${escapeHtml(message)}</p>
            <button class="primary-button" type="submit">เข้าสู่ Dashboard</button>
          </form>
        </section>
      `;
      document.body.append(backdrop);

      const form = backdrop.querySelector("#managerAuthForm");
      const input = backdrop.querySelector("#managerAuthToken");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const token = input.value.trim();
        if (!token) return;
        sessionStorage.setItem(STORAGE_KEY, token);
        backdrop.remove();
        pendingRequest = null;
        mountChangeButton();
        resolve(token);
      });
      window.setTimeout(() => input.focus(), 0);
    });

    return pendingRequest;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function getToken() {
    const token = cleanLegacyTokenFromUrl() || storedToken();
    if (token) {
      mountChangeButton();
      return token;
    }
    return requestToken();
  }

  async function reset(message) {
    sessionStorage.removeItem(STORAGE_KEY);
    document.querySelector("#managerAuthChange")?.remove();
    return requestToken(message || "รหัสผู้บริหารไม่ถูกต้อง กรุณาลองใหม่");
  }

  function isAuthError(error) {
    const message = String(error?.message || error || "");
    return /manager.?token|invalid.?token|unauthorized|forbidden|ไม่มีสิทธิ์|รหัสผู้บริหาร|token สำหรับผู้บริหาร/i.test(message);
  }

  window.ManagerAuth = { getToken, reset, isAuthError };
})();
