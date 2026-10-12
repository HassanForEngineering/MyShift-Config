(() => {
  "use strict";
  const CONFIG_URL = "https://raw.githubusercontent.com/HassanForEngineering/MyShift-Config/main/server.json";
  const status = document.getElementById("status");
  const availability = document.getElementById("availability");
  const maintenanceMessage = document.getElementById("maintenance-message");
  const retry = document.getElementById("retry");
  const requestForm = document.getElementById("request-form");
  const confirmForm = document.getElementById("confirm-form");
  const result = document.getElementById("request-result");
  const supportContact = document.getElementById("support-contact");
  const requestButton = document.getElementById("request-otp");
  const confirmButton = document.getElementById("confirm-delete-button");
  let config = null;
  let challengeId = "";
  let normalizedPhone = "";

  function showStatus(message, kind = "") {
    status.className = `status ${kind}`.trim();
    status.replaceChildren(document.createTextNode(message));
  }
  function showResult(message, kind = "") {
    result.hidden = false;
    result.className = `status ${kind}`.trim();
    result.replaceChildren(document.createTextNode(message));
  }
  function validConfig(data) {
    if (!data || typeof data !== "object" || typeof data.server_url !== "string" ||
        !/^https:\/\//i.test(data.server_url) || typeof data.maintenance !== "boolean" ||
        typeof data.maintenance_message !== "string") return false;
    try {
      const url = new URL(data.server_url);
      return url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !url.search && !url.hash;
    } catch (_) { return false; }
  }
  function setFormsEnabled(enabled) {
    for (const control of requestForm.elements) control.disabled = !enabled;
    for (const control of confirmForm.elements) control.disabled = !enabled;
    retry.disabled = false;
  }
  async function apiPost(path, payload) {
    const base = config.server_url.replace(/\/+$/, "");
    const response = await fetch(`${base}/api/v1/${path}`, {
      method: "POST", cache: "no-store",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let body;
    try { body = await response.json(); } catch (_) { throw new Error("استجابة غير مفهومة من السيرفر."); }
    if (!response.ok) {
      const detail = body && body.detail;
      const code = detail && typeof detail === "object" ? detail.code : "";
      const messages = {
        ACCOUNT_DELETION_OTP_PROVIDER_NOT_CONFIGURED: "التحقق الخارجي غير مهيأ بعد على السيرفر. يمكنك استخدام مسار الحذف داخل التطبيق.",
        ACCOUNT_DELETION_OTP_DELIVERY_FAILED: "تعذر إرسال رمز التحقق. لم يتم حذف الحساب؛ حاول لاحقًا.",
        OTP_INVALID_OR_EXPIRED: "رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.",
        OTP_RATE_LIMITED: "تم تجاوز عدد طلبات التحقق. انتظر قليلًا قبل المحاولة مرة أخرى.",
        ACCOUNT_DELETION_STORAGE_UNAVAILABLE: "تعذر حذف الملفات الشخصية بأمان. لم يكتمل حذف الحساب.",
        ACCOUNT_DELETION_STORAGE_FAILED: "تعذر حذف الملفات الشخصية بأمان. لم يكتمل حذف الحساب.",
        ACCOUNT_DELETION_OWNER_TRANSFER_REQUIRED: "قبل حذف الحساب، انقل ملكية المؤسسة إلى عضو آخر أو عيّن مالكًا نشطًا بديلًا. لم يتم حذف الحساب.",
        ACCOUNT_DELETION_DIRECT_REPORTS_REQUIRED: "يوجد موظفون يتبعونك إداريًا. أعد تعيين مديرهم من إعدادات المؤسسة ثم أعد محاولة حذف الحساب. لم يتم حذف الحساب.",
        REQUIRED_AUTH: "انتهت الجلسة. لم يتم حذف الحساب من هذا الطلب."
      };
      throw new Error(messages[code] || (detail && detail.message) || `فشل الطلب (HTTP ${response.status}). لم يتم تأكيد الحذف.`);
    }
    return body && body.data;
  }
  async function loadStatus() {
    retry.disabled = true;
    retry.textContent = "جارٍ الفحص…";
    showStatus("جارٍ تحميل إعدادات الخدمة…");
    availability.textContent = "جارٍ التحقق من حالة الخدمة…";
    maintenanceMessage.hidden = true;
    requestForm.hidden = true;
    confirmForm.hidden = true;
    setFormsEnabled(false);
    try {
      const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
        cache: "no-store", headers: { "Accept": "application/json", "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error("CONFIG_HTTP");
      const loaded = await response.json();
      if (!validConfig(loaded)) throw new Error("CONFIG_INVALID");
      config = loaded;
      // Show only a support number explicitly configured by the server operator.
      // Never invent a phone number or accept arbitrary HTML from the API.
      try {
        const supportResponse = await fetch(`${config.server_url.replace(/\/+$/, "")}/api/v1/app/config`, {
          cache: "no-store", headers: { "Accept": "application/json" }
        });
        if (supportResponse.ok) {
          const supportPayload = await supportResponse.json();
          const rawSupport = String(supportPayload?.data?.supportWhatsapp || "");
          const digits = rawSupport.replace(/\D/g, "");
          if (digits.length >= 8) {
            const link = document.createElement("a");
            link.href = `https://wa.me/${digits}`;
            link.rel = "noopener noreferrer";
            link.target = "_blank";
            link.textContent = "التواصل مع دعم MyShift عبر WhatsApp";
            supportContact.replaceChildren(link);
            supportContact.hidden = false;
          } else {
            supportContact.hidden = true;
          }
        }
      } catch (_) { supportContact.hidden = true; }
      if (config.maintenance) {
        showStatus("الخدمة في وضع الصيانة", "warning");
        availability.textContent = "طلبات حذف الحساب متوقفة أثناء الصيانة.";
        maintenanceMessage.textContent = config.maintenance_message.trim() || "تُجرى أعمال صيانة. يُرجى المحاولة لاحقًا.";
        maintenanceMessage.hidden = false;
        return;
      }
      showStatus("تم تحميل الإعدادات. لا يعني ذلك أن السيرفر أو مزود التحقق متاحان حتى اختبار الطلب.", "success");
      availability.textContent = "يمكنك بدء طلب خارجي. إذا لم يكن مزود WhatsApp مهيأ، سيعرض السيرفر ذلك بوضوح ولن يُحذف أي حساب.";
      requestForm.hidden = false;
      setFormsEnabled(true);
    } catch (error) {
      config = null;
      showStatus(error.message === "CONFIG_INVALID"
        ? "ملف الإعدادات غير صالح أو ينقصه حقول مطلوبة."
        : "تعذّر تحميل إعدادات الخدمة. لم يتم إرسال أي طلب.", "error");
      availability.textContent = "تحقق من اتصال الإنترنت ومن نشر ملف server.json، ثم أعد المحاولة.";
      showResult("لم يتم إرسال طلب حذف.", "error");
    } finally {
      retry.disabled = false;
      retry.textContent = "إعادة فحص الحالة";
    }
  }
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!config || config.maintenance) return;
    normalizedPhone = document.getElementById("phone").value.trim();
    requestButton.disabled = true;
    requestButton.textContent = "جارٍ طلب الرمز…";
    try {
      const data = await apiPost("account-deletion/request-otp", { phone: normalizedPhone });
      if (!data || data.accepted !== true || typeof data.challengeId !== "string" || !data.challengeId) {
        throw new Error("لم يؤكد السيرفر قبول طلب التحقق. لم يتم حذف الحساب.");
      }
      challengeId = data.challengeId;
      confirmForm.hidden = false;
      showResult(data.message || "إذا كان الرقم مرتبطًا بحساب، فسيصلك رمز التحقق.", "success");
      availability.textContent = "أدخل رمز التحقق ثم راجع التأكيد النهائي. قبول طلب الرمز ليس حذفًا للحساب.";
    } catch (error) {
      showResult(error.message || "تعذر إرسال رمز التحقق. لم يتم حذف الحساب.", "error");
    } finally {
      requestButton.disabled = false;
      requestButton.textContent = "إرسال رمز التحقق";
    }
  });
  confirmForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!config || config.maintenance || !challengeId) return;
    if (!document.getElementById("confirm-delete").checked) {
      showResult("يجب تأكيد ملكية الحساب والموافقة على الحذف النهائي.", "error");
      return;
    }
    confirmButton.disabled = true;
    confirmButton.textContent = "جارٍ تنفيذ الحذف…";
    try {
      const code = document.getElementById("otp").value.trim();
      const data = await apiPost("account-deletion/confirm", {
        phone: normalizedPhone, challenge_id: challengeId, code, confirmation: "DELETE_MY_ACCOUNT"
      });
      if (!data || data.deleted !== true || data.accountStatus !== "DELETED") {
        throw new Error("لم يؤكد السيرفر اكتمال الحذف. لا تعتبر الحساب محذوفًا.");
      }
      requestForm.hidden = true;
      confirmForm.hidden = true;
      challengeId = "";
      showStatus("أكد السيرفر حذف الحساب", "success");
      availability.textContent = "اكتمل حذف الحساب وفق تأكيد السيرفر. احتُفظ بسجلات المؤسسة المشتركة التي لا ينبغي حذفها مع الحساب.";
      showResult("تم حذف الحساب بنجاح وفق تأكيد السيرفر. يمكنك الاحتفاظ بهذه النتيجة كمرجع، دون تضمين رمز التحقق.", "success");
    } catch (error) {
      showResult(`${error.message || "تعذر إتمام الطلب."} لم تعرض الصفحة نجاحًا ولم تمسح بيانات السيرفر بنفسها.`, "error");
    } finally {
      confirmButton.disabled = false;
      confirmButton.textContent = "تأكيد الحذف النهائي";
    }
  });
  retry.addEventListener("click", loadStatus);
  loadStatus();
})();
