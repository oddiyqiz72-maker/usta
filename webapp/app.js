// =========================================================
// USTAK — Mini App frontend logikasi
// =========================================================

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tgUser = tg?.initDataUnsafe?.user || null;
const CURRENT_TG_ID = tgUser?.id || null;
const CURRENT_USERNAME = tgUser?.username || null;
const CURRENT_NAME = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") || null;

const API = ""; // bir xil origin

// ---------------------------------------------------------------- state --

let specialties = [];
let cities = [];
let activeSpecialty = "";
let searchDebounce = null;
let bgWarningAccepted = false;
let pendingCallMasterId = null;
let customerProfile = null;
let aiHistory = [];
let aiImageFile = null;
let aiSending = false;

// -------------------------------------------------------------- helpers --

function el(id) { return document.getElementById(id); }

function showToast(message, type = "info") {
  const container = el("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function extractErrorMessage(err) {
  // FastAPI/Pydantic xatolari ro'yxat yoki obyekt bo'lishi mumkin
  if (!err) return "Noma'lum xatolik yuz berdi";
  if (typeof err === "string") return err;
  if (err.detail) {
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) {
      return err.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
    }
    return JSON.stringify(err.detail);
  }
  return "Noma'lum xatolik yuz berdi";
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, options);
  let data = null;
  try { data = await res.json(); } catch (_) { /* body yo'q */ }
  if (!res.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "hozirgina";
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

// ================================================================ tabs ==

const tabButtons = document.querySelectorAll(".tab-btn");
const tabIndicator = el("tabIndicator");

function setActiveTabVisual(tabName, animateIndicator = true) {
  tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
  const idx = Array.from(tabButtons).findIndex((b) => b.dataset.tab === tabName);
  if (idx >= 0) {
    tabIndicator.style.transition = animateIndicator ? "" : "none";
    tabIndicator.style.transform = `translateX(${idx * 100}%)`;
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tabName = btn.dataset.tab;
    setActiveTabVisual(tabName);
    if (tabName === "profile") loadProfileTab();
  });
});

function goToMastersTab(specialtyKey) {
  if (specialtyKey) {
    activeSpecialty = specialtyKey;
    document.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.key === specialtyKey);
    });
  }
  setActiveTabVisual("masters");
  loadMasters();
}

// ============================================================ reference ==

async function loadReferenceData() {
  const [spec, cty] = await Promise.all([
    apiFetch("/api/specialties"),
    apiFetch("/api/cities"),
  ]);
  specialties = spec;
  cities = cty;

  // qidiruv chip'lari
  const chipRow = el("specialtyChips");
  chipRow.innerHTML = `<button class="chip active" data-key="">🗂️ Hammasi</button>` +
    specialties.map((s) => `<button class="chip" data-key="${s.key}">${s.emoji} ${s.name}</button>`).join("");

  chipRow.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeSpecialty = chip.dataset.key;
      loadMasters();
    });
  });

  // hudud filter select
  const cityFilter = el("cityFilter");
  cityFilter.innerHTML = `<option value="">Barcha hududlar</option>` +
    cities.map((c) => `<option value="${c}">${c}</option>`).join("");
  cityFilter.addEventListener("change", loadMasters);

  // ro'yxatdan o'tish forma select'lari
  const fSpecialty = el("f_specialty");
  fSpecialty.innerHTML = `<option value="" disabled selected>Tanlang...</option>` +
    specialties.map((s) => `<option value="${s.key}">${s.emoji} ${s.name}</option>`).join("");

  const fCity = el("f_city");
  fCity.innerHTML = `<option value="" disabled selected>Tanlang...</option>` +
    cities.map((c) => `<option value="${c}">${c}</option>`).join("");
}

// ============================================================== search ==

function renderSkeletons(count = 3) {
  const list = el("masterList");
  list.innerHTML = Array.from({ length: count })
    .map(() => `<div class="skeleton-card"></div>`)
    .join("");
}

function starString(avg) {
  const rounded = Math.round(avg);
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function renderMasterCard(m, index) {
  const photo = m.photo_path ? m.photo_path : "";
  const telegramBtn = m.telegram_username
    ? `<a class="action-btn telegram" href="https://t.me/${m.telegram_username}" target="_blank" rel="noopener">✈️</a>`
    : "";
  const priceHtml = m.price_info ? `<p class="master-price">💰 ${escapeHtml(m.price_info)}</p>` : "";
  const bioHtml = m.bio ? `<p class="master-bio">${escapeHtml(m.bio)}</p>` : "";

  return `
    <div class="master-card" style="animation-delay:${index * 60}ms" data-master-id="${m.id}">
      <div class="master-card-top">
        ${photo ? `<img class="master-photo" src="${photo}" alt="${escapeHtml(m.full_name)}">` : `<div class="master-photo"></div>`}
        <div class="master-info">
          <h3 class="master-name">${escapeHtml(m.full_name)}</h3>
          <span class="master-specialty">${escapeHtml(m.specialty_label)}</span>
          <div class="master-meta">
            <span>🎂 ${m.age} yosh</span>
            <span>🛠️ ${m.experience_years} yil</span>
            <span>📍 ${escapeHtml(m.city)}</span>
          </div>
          <div class="master-rating">
            <span class="stars">${starString(m.avg_rating)}</span>
            <span class="count">${m.avg_rating > 0 ? m.avg_rating.toFixed(1) : "—"} (${m.rating_count})</span>
          </div>
        </div>
      </div>
      ${bioHtml}
      ${priceHtml}
      <div class="master-actions">
        <a class="action-btn call" href="tel:${m.phone}">📞 Qo'ng'iroq</a>
        ${telegramBtn}
        <button class="action-btn call-master" data-master-id="${m.id}">🔔 Chaqirish</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadMasters() {
  renderSkeletons();
  el("emptyState").hidden = true;

  const params = new URLSearchParams();
  if (activeSpecialty) params.set("specialty", activeSpecialty);
  const city = el("cityFilter").value;
  if (city) params.set("city", city);
  const search = el("searchInput").value.trim();
  if (search) params.set("search", search);

  try {
    const masters = await apiFetch(`/api/masters?${params.toString()}`);
    const list = el("masterList");
    if (masters.length === 0) {
      list.innerHTML = "";
      el("emptyState").hidden = false;
      return;
    }
    list.innerHTML = masters.map((m, i) => renderMasterCard(m, i)).join("");
    attachCallHandlers();
  } catch (err) {
    showToast(err.message, "error");
    el("masterList").innerHTML = "";
  }
}

el("searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadMasters, 350);
});

// -------------------------------------------------------- chaqirish tugmasi --

function attachCallHandlers() {
  document.querySelectorAll(".action-btn.call-master").forEach((btn) => {
    btn.addEventListener("click", () => handleCallMaster(btn));
  });
}

function handleCallMaster(btn) {
  if (!CURRENT_TG_ID) {
    showToast("Telegram orqali ochilishi kerak", "error");
    return;
  }
  pendingCallMasterId = btn.dataset.masterId;
  el("locationInput").value = customerProfile?.location || "";
  el("locationModal").hidden = false;
  el("locationInput").focus();
}

async function submitCallWithLocation() {
  const masterId = pendingCallMasterId;
  const location = el("locationInput").value.trim();
  if (!location) {
    showToast("Iltimos, manzilingizni kiriting", "error");
    return;
  }
  const btn = document.querySelector(`.action-btn.call-master[data-master-id="${masterId}"]`);
  const submitBtn = el("locationSubmit");
  submitBtn.disabled = true;

  const formData = new FormData();
  formData.append("master_id", masterId);
  formData.append("customer_telegram_id", CURRENT_TG_ID);
  if (CURRENT_USERNAME) formData.append("customer_username", CURRENT_USERNAME);
  if (CURRENT_NAME) formData.append("customer_name", CURRENT_NAME);
  formData.append("location", location);

  try {
    await apiFetch("/api/calls", { method: "POST", body: formData });
    customerProfile = customerProfile || {};
    customerProfile.location = location;
    el("locationModal").hidden = true;
    if (btn) {
      btn.classList.add("stamped");
      btn.disabled = true;
      btn.innerHTML = `<span class="stamp-pop">✅ Chaqirildi!</span>`;
    }
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    showToast("Usta xabardor qilindi. Tez orada bog'lanadi!", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
}

el("locationCancel").addEventListener("click", () => {
  el("locationModal").hidden = true;
  pendingCallMasterId = null;
});

el("locationSubmit").addEventListener("click", submitCallWithLocation);

// ========================================================== reg modal ==

el("becomeMasterBtn").addEventListener("click", () => {
  el("registerModal").hidden = false;
});

el("registerModalClose").addEventListener("click", () => {
  el("registerModal").hidden = true;
});

// ======================================================== register form ==

const photoInput = el("photoInput");
const photoPreview = el("photoPreview");
let selectedPhotoFile = null;

el("photoUpload").addEventListener("click", (e) => {
  if (e.target.tagName !== "INPUT") photoInput.click();
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  selectedPhotoFile = file;
  bgWarningAccepted = false;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      photoPreview.innerHTML = "";
      const imgEl = document.createElement("img");
      imgEl.src = e.target.result;
      photoPreview.appendChild(imgEl);
      photoPreview.classList.add("has-image");
      checkBackgroundBrightness(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

function checkBackgroundBrightness(img) {
  // Heuristika: rasm burchaklaridagi piksellar yorqinligini o'lchaydi.
  // 100% aniq emas — faqat taxminiy tekshiruv.
  const canvas = document.createElement("canvas");
  const w = (canvas.width = 60);
  const h = (canvas.height = 60);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const corners = [
    ctx.getImageData(0, 0, 6, 6).data,
    ctx.getImageData(w - 6, 0, 6, 6).data,
    ctx.getImageData(0, h - 6, 6, 6).data,
    ctx.getImageData(w - 6, h - 6, 6, 6).data,
  ];

  let total = 0;
  let count = 0;
  corners.forEach((data) => {
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count++;
    }
  });
  const brightness = total / count;
  const warningEl = el("photoWarning");
  if (brightness < 170) {
    warningEl.hidden = false;
    warningEl.classList.add("shake");
    setTimeout(() => warningEl.classList.remove("shake"), 400);
  } else {
    warningEl.hidden = true;
    bgWarningAccepted = true;
  }
}

el("f_bio").addEventListener("input", (e) => {
  el("bioCounter").textContent = `${e.target.value.length}/200`;
});

el("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!CURRENT_TG_ID) {
    showToast("Telegram orqali ochilishi kerak", "error");
    return;
  }
  if (!selectedPhotoFile) {
    showToast("Iltimos, rasm yuklang", "error");
    return;
  }
  const warningEl = el("photoWarning");
  if (!warningEl.hidden && !bgWarningAccepted) {
    const proceed = confirm("Fon och emasga o'xshaydi. Baribir davom etamizmi?");
    if (!proceed) return;
    bgWarningAccepted = true;
  }

  const submitBtn = el("registerSubmit");
  submitBtn.disabled = true;
  const originalLabel = submitBtn.querySelector(".btn-label").textContent;
  submitBtn.querySelector(".btn-label").textContent = "Yuborilmoqda...";

  const formData = new FormData();
  formData.append("telegram_id", CURRENT_TG_ID);
  if (CURRENT_USERNAME) formData.append("telegram_username", CURRENT_USERNAME);
  formData.append("full_name", el("f_full_name").value.trim());
  formData.append("age", el("f_age").value);
  formData.append("experience_years", el("f_experience").value);
  formData.append("specialty", el("f_specialty").value);
  formData.append("city", el("f_city").value);
  formData.append("phone", el("f_phone").value.trim());
  formData.append("price_info", el("f_price").value.trim());
  formData.append("bio", el("f_bio").value.trim());
  formData.append("photo", selectedPhotoFile);

  try {
    await apiFetch("/api/register", { method: "POST", body: formData });
    submitBtn.classList.add("success");
    submitBtn.querySelector(".btn-label").innerHTML = `<span class="stamp-pop">✅ Ro'yxatdan o'tdingiz!</span>`;
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    showToast("Siz endi mijozlarga ko'rinasiz!", "success");
    e.target.reset();
    photoPreview.innerHTML = `<span class="photo-placeholder-icon">📷</span><span class="photo-placeholder-text">Rasm yuklash</span>`;
    photoPreview.classList.remove("has-image");
    selectedPhotoFile = null;
    el("bioCounter").textContent = "0/200";
    setTimeout(() => {
      submitBtn.classList.remove("success");
      submitBtn.querySelector(".btn-label").textContent = originalLabel;
      submitBtn.disabled = false;
      el("registerModal").hidden = true;
      loadMyMasters();
      if (document.querySelector('.tab-panel#tab-masters.active')) loadMasters();
    }, 1400);
  } catch (err) {
    showToast(err.message, "error");
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-label").textContent = originalLabel;
  }
});

// ============================================================ profile ==

async function loadProfileTab() {
  if (!CURRENT_TG_ID) return;
  await Promise.all([loadCustomerProfile(), loadPendingCalls(), loadMyMasters()]);
}

async function loadCustomerProfile() {
  try {
    customerProfile = await apiFetch(`/api/customers/${CURRENT_TG_ID}`);
  } catch (_) {
    customerProfile = null;
  }
  el("profileName").textContent = customerProfile?.full_name || CURRENT_NAME || "—";
  el("profilePhone").textContent = customerProfile?.phone || "Telefon raqami yo'q";
}

async function loadPendingCalls() {
  try {
    const calls = await apiFetch(`/api/calls/pending/${CURRENT_TG_ID}`);
    const list = el("callsList");
    el("callsEmpty").hidden = calls.length > 0;
    list.innerHTML = calls.map((c) => `
      <div class="call-row" data-call-id="${c.id}">
        <div class="call-row-icon">👤</div>
        <div class="call-row-info">
          <p class="call-row-name">${escapeHtml(c.customer_name || "Mijoz")}</p>
          ${c.customer_username ? `<a class="call-row-link" href="https://t.me/${c.customer_username}" target="_blank">✈️ @${c.customer_username}</a>` : ""}
          <div class="call-row-time">${timeAgo(c.created_at)}</div>
        </div>
        <button class="call-row-btn" data-call-id="${c.id}">✅ Tugatdim</button>
      </div>
    `).join("");

    list.querySelectorAll(".call-row-btn").forEach((btn) => {
      btn.addEventListener("click", () => finishCall(btn.dataset.callId));
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function finishCall(callId) {
  const row = document.querySelector(`.call-row[data-call-id="${callId}"]`);
  const formData = new FormData();
  formData.append("master_telegram_id", CURRENT_TG_ID);
  try {
    await apiFetch(`/api/calls/${callId}/finish`, { method: "POST", body: formData });
    if (row) {
      row.classList.add("removing");
      setTimeout(() => {
        row.remove();
        const remaining = document.querySelectorAll(".call-row").length;
        el("callsEmpty").hidden = remaining > 0;
      }, 350);
    }
    showToast("Mijozga baholash taklifi yuborildi", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadMyMasters() {
  try {
    const masters = await apiFetch(`/api/my-masters/${CURRENT_TG_ID}`);
    const list = el("myMastersList");
    el("myMastersEmpty").hidden = masters.length > 0;
    list.innerHTML = masters.map((m) => `
      <div class="my-master-row" data-master-id="${m.id}">
        ${m.photo_path ? `<img class="my-master-photo" src="${m.photo_path}">` : `<div class="my-master-photo"></div>`}
        <div class="my-master-info">
          <p class="my-master-name">${escapeHtml(m.full_name)}</p>
          <p class="my-master-meta">${escapeHtml(m.specialty_label)} · ⭐ ${m.avg_rating > 0 ? m.avg_rating.toFixed(1) : "—"} (${m.rating_count})</p>
        </div>
        <button class="delete-btn" data-master-id="${m.id}" title="O'chirish">🗑️</button>
      </div>
    `).join("");

    list.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteMaster(btn.dataset.masterId));
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteMaster(masterId) {
  if (!confirm("E'lonni o'chirishni tasdiqlaysizmi?")) return;
  const formData = new FormData();
  formData.append("telegram_id", CURRENT_TG_ID);
  try {
    await apiFetch(`/api/masters/${masterId}/delete`, { method: "POST", body: formData });
    showToast("E'lon o'chirildi", "success");
    loadMyMasters();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ============================================================ ai chat ==

function aiScrollToBottom() {
  const box = el("aiMessages");
  box.scrollTop = box.scrollHeight;
}

function renderAiMessage(role, html) {
  const box = el("aiMessages");
  const wrap = document.createElement("div");
  wrap.className = `ai-msg ai-msg-${role === "user" ? "user" : "bot"}`;
  wrap.innerHTML = `<div class="ai-msg-bubble">${html}</div>`;
  box.appendChild(wrap);
  aiScrollToBottom();
  return wrap;
}

el("aiAttachBtn").addEventListener("click", () => el("aiImageInput").click());

el("aiImageInput").addEventListener("change", () => {
  const file = el("aiImageInput").files[0];
  if (!file) return;
  aiImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    el("aiImagePreviewImg").src = e.target.result;
    el("aiImagePreview").hidden = false;
  };
  reader.readAsDataURL(file);
});

el("aiImageRemove").addEventListener("click", () => {
  aiImageFile = null;
  el("aiImageInput").value = "";
  el("aiImagePreview").hidden = true;
});

async function sendAiMessage() {
  if (aiSending) return;
  const input = el("aiTextInput");
  const text = input.value.trim();
  if (!text && !aiImageFile) return;

  aiSending = true;
  el("aiSendBtn").disabled = true;

  let userHtml = escapeHtml(text);
  if (aiImageFile) {
    userHtml += `<br><img class="ai-msg-image" src="${el("aiImagePreviewImg").src}">`;
  }
  renderAiMessage("user", userHtml || "📷 rasm");

  const loadingMsg = renderAiMessage("bot", `<span class="ai-typing">Yozmoqda...</span>`);

  const formData = new FormData();
  formData.append("message", text);
  formData.append("history", JSON.stringify(aiHistory));
  if (aiImageFile) formData.append("image", aiImageFile);

  input.value = "";
  const sentImageFile = aiImageFile;
  aiImageFile = null;
  el("aiImageInput").value = "";
  el("aiImagePreview").hidden = true;

  try {
    const result = await apiFetch("/api/ai/chat", { method: "POST", body: formData });
    loadingMsg.remove();

    let replyHtml = escapeHtml(result.reply).replace(/\n/g, "<br>");
    const botMsgEl = renderAiMessage("bot", replyHtml);

    aiHistory.push({ role: "user", content: text || "(rasm yubordi)" });
    aiHistory.push({ role: "assistant", content: result.reply });

    if (result.suggested_specialty) {
      const btnWrap = document.createElement("div");
      btnWrap.className = "ai-suggest-btn-wrap";
      btnWrap.innerHTML = `<button class="ai-suggest-btn" data-key="${result.suggested_specialty}">🔍 ${escapeHtml(result.suggested_specialty_label)} ustalarini ko'rish</button>`;
      botMsgEl.appendChild(btnWrap);
      btnWrap.querySelector(".ai-suggest-btn").addEventListener("click", () => {
        goToMastersTab(result.suggested_specialty);
      });
    }
  } catch (err) {
    loadingMsg.remove();
    renderAiMessage("bot", `⚠️ ${escapeHtml(err.message)}`);
  } finally {
    aiSending = false;
    el("aiSendBtn").disabled = false;
  }
}

el("aiSendBtn").addEventListener("click", sendAiMessage);
el("aiTextInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendAiMessage();
  }
});

// ============================================================== init ==

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  let tab = params.get("tab");
  // eski deep-linklar bilan moslik
  if (tab === "search") tab = "masters";
  if (tab === "register") {
    setActiveTabVisual("profile");
    loadProfileTab();
    el("registerModal").hidden = false;
    return;
  }
  if (tab === "masters" || tab === "ai" || tab === "pro" || tab === "profile") {
    setActiveTabVisual(tab);
    if (tab === "profile") loadProfileTab();
  }
}

async function init() {
  setActiveTabVisual("masters", false);
  await loadReferenceData();
  await loadMasters();
  handleDeepLink();
}

init();
