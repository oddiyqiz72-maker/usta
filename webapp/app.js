// ===========================================================
// UstaKerak — webapp frontend logic (vanilla JS)
// ===========================================================
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
const TG_ID = tgUser ? tgUser.id : null;
const TG_USERNAME = tgUser ? (tgUser.username || "") : "";
const TG_NAME = tgUser ? `${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim() : "Mehmon";

const API = ""; // bir xil origin

const state = {
  specialties: [],
  cities: [],
  activeSpecialty: "",
  activeCity: "",
  searchQuery: "",
  masters: [],
  favorites: new Set(),
  aiHistory: [], // {role, content}
  aiPendingImage: null, // {base64, mediaType, previewUrl}
  currentCallMaster: null,
  currentRateMaster: null,
  userPrefs: { dark_mode: 1, animations: 1 },
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  if (!res.ok) {
    let msg = "Xatolik yuz berdi";
    try {
      const data = await res.json();
      msg = extractErrorMessage(data);
    } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

// FastAPI/Pydantic validatsiya xatolarini o'qiladigan matnga aylantiradi
function extractErrorMessage(data) {
  const d = data && data.detail !== undefined ? data.detail : data;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d.map((e) => (typeof e === "string" ? e : (e.msg || JSON.stringify(e)))).join("\n");
  }
  if (d && typeof d === "object") {
    if (Array.isArray(d.detail)) return extractErrorMessage(d.detail);
    return JSON.stringify(d);
  }
  return "Xatolik yuz berdi";
}

// ------------------------------------------------------- theme / prefs ---

function applyTheme() {
  document.body.setAttribute("data-theme", state.userPrefs.dark_mode ? "dark" : "light");
  document.body.classList.toggle("no-anim", !state.userPrefs.animations);
  $("#darkModeToggle").checked = !!state.userPrefs.dark_mode;
  $("#animToggle").checked = !!state.userPrefs.animations;
}

async function loadUser() {
  applyProfileAvatar();
  if (!TG_ID) return;
  try {
    const user = await api(`/api/user/${TG_ID}`);
    state.userPrefs.dark_mode = user.dark_mode;
    state.userPrefs.animations = user.animations;
    $("#profileName").textContent = user.full_name || TG_NAME || "Foydalanuvchi";
    $("#profilePhone").textContent = user.phone || "";
  } catch (e) {
    $("#profileName").textContent = TG_NAME || "Foydalanuvchi";
    $("#profilePhone").textContent = "Botga /start yuborib, raqamingizni ulashing";
  }
  applyTheme();
}

function applyProfileAvatar() {
  const img = $("#profileAvatarImg");
  const fallback = $("#profileAvatarFallback");
  const showIfLoads = (src) => {
    img.onload = () => { img.classList.remove("hidden"); fallback.classList.add("hidden"); };
    img.onerror = () => { img.classList.add("hidden"); fallback.classList.remove("hidden"); };
    img.src = src;
  };
  if (TG_ID) {
    showIfLoads(`/api/user/${TG_ID}/photo`);
  } else if (tgUser && tgUser.photo_url) {
    showIfLoads(tgUser.photo_url);
  }
}

// -------------------------------------------------------------- tabs ----

function switchView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${name}`).classList.remove("hidden");
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  const subs = {
    masters: "tezkor usta chaqiruv",
    ai: "aqlli yordamchi",
    profile: "sozlamalar",
  };
  $("#brandSub").textContent = subs[name] || "";
}

$$(".nav-btn").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));

// ---------------------------------------------------------- reference ----

async function loadReference() {
  state.specialties = await api("/api/specialties");
  state.cities = await api("/api/cities");
  renderChips();
  renderCitySelects();
  renderRegSpecialties();
}

function renderChips() {
  const wrap = $("#specialtyChips");
  wrap.innerHTML = `<div class="chip ${state.activeSpecialty === "" ? "active" : ""}" data-code="">🗂️ Hammasi</div>` +
    state.specialties.map((s) => `<div class="chip ${state.activeSpecialty === s.code ? "active" : ""}" data-code="${s.code}">${s.emoji} ${s.name}</div>`).join("");
  $$(".chip", wrap).forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeSpecialty = chip.dataset.code;
      renderChips();
      loadMasters();
    });
  });
}

function renderCitySelects() {
  const opts = state.cities.map((c) => `<option value="${c}">${c}</option>`).join("");
  $("#cityFilter").innerHTML = `<option value="">📍 Barcha hududlar</option>` + opts;
  $("#regCity").innerHTML = `<option value="" disabled selected>Hududni tanlang</option>` + opts;
}

function renderRegSpecialties() {
  $("#regSpecialty").innerHTML = `<option value="" disabled selected>Sohani tanlang</option>` +
    state.specialties.map((s) => `<option value="${s.code}">${s.emoji} ${s.name}</option>`).join("");
}

// ------------------------------------------------------------ masters ----

async function loadMasters() {
  const params = new URLSearchParams();
  if (state.activeSpecialty) params.set("specialty", state.activeSpecialty);
  if (state.activeCity) params.set("city", state.activeCity);
  if (state.searchQuery) params.set("search", state.searchQuery);
  state.masters = await api(`/api/masters?${params.toString()}`);
  renderMasters();
}

function specialtyOf(code) {
  return state.specialties.find((s) => s.code === code) || { name: code, emoji: "🛠️", color: "#888" };
}

function renderMasters() {
  const list = $("#masterList");
  const empty = $("#mastersEmpty");
  if (!state.masters.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  list.innerHTML = state.masters.map((m) => masterCardHtml(m)).join("");
  $$(".master-card", list).forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".action-btn")) return;
      openMasterModal(Number(card.dataset.id));
    });
  });
  $$(".action-btn.call", list).forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openCallModal(Number(btn.closest(".master-card").dataset.id));
  }));
  $$(".action-btn.fav", list).forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavorite(Number(btn.closest(".master-card").dataset.id), btn);
  }));
  $$(".action-btn.tel", list).forEach((btn) => btn.addEventListener("click", (e) => e.stopPropagation()));
}

function masterCardHtml(m) {
  const sp = specialtyOf(m.specialty);
  const isFav = state.favorites.has(m.id);
  const rating = m.avg_rating ? m.avg_rating.toFixed(1) : "—";
  return `
  <div class="master-card" data-id="${m.id}">
    <img class="master-photo" src="${m.photo_path}" alt="${m.full_name}">
    <div class="master-main">
      <div class="master-top-row">
        <span class="master-name">${escapeHtml(m.full_name)}</span>
        <span class="master-code">${m.master_code}</span>
      </div>
      <div class="master-specialty">${sp.emoji} ${sp.name} · ${m.city}</div>
      <div class="master-meta">
        <span>🧰 ${m.experience_years} yil tajriba</span>
        ${m.price_info ? `<span>💰 ${escapeHtml(m.price_info)}</span>` : ""}
      </div>
      <div class="master-rating">⭐ ${rating} <span class="count">(${m.rating_count})</span></div>
    </div>
    <div class="master-actions">
      <a class="action-btn tel" href="tel:${m.phone}" title="Qo'ng'iroq">📞</a>
      <button class="action-btn fav ${isFav ? "active" : ""}" title="Saqlash">${isFav ? "❤️" : "🤍"}</button>
      <button class="action-btn call" title="Chaqirish">🔔</button>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("#searchInput").addEventListener("input", debounce((e) => {
  state.searchQuery = e.target.value.trim();
  loadMasters();
}, 350));

$("#cityFilter").addEventListener("change", (e) => {
  state.activeCity = e.target.value;
  loadMasters();
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// -------------------------------------------------------- master modal ----

function openMasterModal(id) {
  const m = state.masters.find((x) => x.id === id);
  if (!m) return;
  const sp = specialtyOf(m.specialty);
  const isFav = state.favorites.has(m.id);
  $("#masterModalSheet").innerHTML = `
    <img class="md-photo" src="${m.photo_path}" alt="${m.full_name}">
    <div class="md-header">
      <span class="md-name">${escapeHtml(m.full_name)}</span>
      <span class="master-code">${m.master_code}</span>
    </div>
    <div class="master-specialty">${sp.emoji} ${sp.name} · ${m.city}</div>
    <div class="md-row">
      <span>🧰 ${m.experience_years} yil tajriba</span>
      <span>🎂 ${m.age} yosh</span>
      <span>⭐ ${m.avg_rating ? m.avg_rating.toFixed(1) : "—"} (${m.rating_count})</span>
      ${m.price_info ? `<span>💰 ${escapeHtml(m.price_info)}</span>` : ""}
    </div>
    ${m.bio ? `<div class="md-bio">${escapeHtml(m.bio)}</div>` : ""}
    <div class="md-actions">
      <a class="btn-ghost" style="text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;" href="tel:${m.phone}">📞 Qo'ng'iroq</a>
      <button class="btn-primary" id="mdCallBtn">🔔 Chaqirish</button>
    </div>
    <button class="btn-ghost" style="margin-top:10px;width:100%;" id="mdFavBtn">${isFav ? "❤️ Saqlangan" : "🤍 Saqlash"}</button>
  `;
  $("#mdCallBtn").addEventListener("click", () => { closeModal("masterModal"); openCallModal(id); });
  $("#mdFavBtn").addEventListener("click", (e) => toggleFavorite(id, e.target));
  openModal("masterModal");
}

function openModal(id) { $(`#${id}`).classList.remove("hidden"); }
function closeModal(id) { $(`#${id}`).classList.add("hidden"); }
$$(".modal-overlay").forEach((ov) => ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.add("hidden"); }));

// ------------------------------------------------------------- favorite ----

async function toggleFavorite(masterId, btnEl) {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  try {
    const res = await api("/api/favorites/toggle", {
      method: "POST",
      body: JSON.stringify({ customer_telegram_id: TG_ID, master_id: masterId }),
    });
    if (res.saved) state.favorites.add(masterId); else state.favorites.delete(masterId);
    if (btnEl) {
      if (btnEl.classList.contains("action-btn")) {
        btnEl.classList.toggle("active", res.saved);
        btnEl.textContent = res.saved ? "❤️" : "🤍";
      } else {
        btnEl.textContent = res.saved ? "❤️ Saqlangan" : "🤍 Saqlash";
      }
    }
    toast(res.saved ? "Saqlandi" : "Saqlanganlardan olib tashlandi");
  } catch (e) { toast(e.message); }
}

async function loadFavorites() {
  if (!TG_ID) return;
  try {
    const favs = await api(`/api/favorites/${TG_ID}`);
    state.favorites = new Set(favs.map((f) => f.id));
  } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- call ----

function openCallModal(masterId) {
  const m = state.masters.find((x) => x.id === masterId) || null;
  state.currentCallMaster = masterId;
  $("#callModalMasterName").textContent = m ? `${m.full_name}ni chaqirish` : "Ustani chaqirish";
  $("#callNoteInput").value = "";
  openModal("callModal");
}
$("#callCancelBtn").addEventListener("click", () => closeModal("callModal"));
$("#callConfirmBtn").addEventListener("click", async () => {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  const btn = $("#callConfirmBtn");
  btn.disabled = true; btn.textContent = "Yuborilmoqda...";
  try {
    await api("/api/calls", {
      method: "POST",
      body: JSON.stringify({
        master_id: state.currentCallMaster,
        customer_telegram_id: TG_ID,
        customer_username: TG_USERNAME,
        customer_name: TG_NAME,
        customer_phone: $("#profilePhone").textContent || "",
        note: $("#callNoteInput").value.trim() || null,
      }),
    });
    closeModal("callModal");
    toast("✅ Chaqirildi! Usta tez orada bog'lanadi");
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false; btn.textContent = "🔔 Chaqirish";
  }
});

// -------------------------------------------------------------- rating ----

let selectedStars = 0;
function openRateModal(masterId) {
  state.currentRateMaster = masterId;
  selectedStars = 0;
  paintStars();
  $("#rateComment").value = "";
  openModal("rateModal");
}
$("#rateCancelBtn").addEventListener("click", () => closeModal("rateModal"));
$$("#starRow span").forEach((star) => star.addEventListener("click", () => {
  selectedStars = Number(star.dataset.star);
  paintStars();
}));
function paintStars() {
  $$("#starRow span").forEach((s) => s.classList.toggle("filled", Number(s.dataset.star) <= selectedStars));
}
$("#rateSubmitBtn").addEventListener("click", async () => {
  if (!selectedStars) { toast("Yulduzchalarni tanlang"); return; }
  try {
    await api(`/api/masters/${state.currentRateMaster}/rate`, {
      method: "POST",
      body: JSON.stringify({ customer_telegram_id: TG_ID, stars: selectedStars, comment: $("#rateComment").value.trim() || null }),
    });
    closeModal("rateModal");
    toast("Rahmat! Bahoyingiz yuborildi ⭐");
  } catch (e) { toast(e.message); }
});

// ------------------------------------------------------------- AI chat ----

function renderAiBubble(role, text, imgUrl) {
  const chat = $("#aiChat");
  const div = document.createElement("div");
  div.className = `ai-msg ${role}`;
  div.innerHTML = `${escapeHtml(text).replace(/\n/g, "<br>")}${imgUrl ? `<img src="${imgUrl}">` : ""}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

if (!state.aiHistory.length) {
  renderAiBubble("assistant", "Salom! 👋 Nima muammo? Yozing yoki rasm yuboring.");
}

$("#aiAttachBtn").addEventListener("click", () => $("#aiImageInput").click());
$("#aiImageInput").addEventListener("change", () => {
  const file = $("#aiImageInput").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const base64 = dataUrl.split(",")[1];
    state.aiPendingImage = { base64, mediaType: file.type, previewUrl: dataUrl };
    $("#aiImagePreview").src = dataUrl;
    $("#aiImagePreviewWrap").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});
$("#aiImageRemove").addEventListener("click", () => {
  state.aiPendingImage = null;
  $("#aiImageInput").value = "";
  $("#aiImagePreviewWrap").classList.add("hidden");
});

async function sendAiMessage() {
  const input = $("#aiTextInput");
  const text = input.value.trim();
  if (!text && !state.aiPendingImage) return;
  const img = state.aiPendingImage;

  renderAiBubble("user", text || "(rasm yuborildi)", img ? img.previewUrl : null);
  state.aiHistory.push({ role: "user", content: text || "Bu rasmda nima muammo bor?" });
  input.value = "";
  state.aiPendingImage = null;
  $("#aiImageInput").value = "";
  $("#aiImagePreviewWrap").classList.add("hidden");

  const thinking = renderAiBubble("assistant thinking", "Yozmoqda...");
  try {
    const res = await api("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: state.aiHistory,
        image_base64: img ? img.base64 : null,
        image_media_type: img ? img.mediaType : null,
      }),
    });
    thinking.remove();
    renderAiBubble("assistant", res.reply);
    state.aiHistory.push({ role: "assistant", content: res.reply });
  } catch (e) {
    thinking.remove();
    renderAiBubble("assistant", "Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}
$("#aiSendBtn").addEventListener("click", sendAiMessage);
$("#aiTextInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendAiMessage(); });

// ------------------------------------------------------------- profile ----

$("#darkModeToggle").addEventListener("change", async (e) => {
  state.userPrefs.dark_mode = e.target.checked ? 1 : 0;
  applyTheme();
  if (TG_ID) api(`/api/user/${TG_ID}/prefs`, { method: "POST", body: JSON.stringify({ dark_mode: state.userPrefs.dark_mode }) }).catch(() => {});
});
$("#animToggle").addEventListener("change", async (e) => {
  state.userPrefs.animations = e.target.checked ? 1 : 0;
  applyTheme();
  if (TG_ID) api(`/api/user/${TG_ID}/prefs`, { method: "POST", body: JSON.stringify({ animations: state.userPrefs.animations }) }).catch(() => {});
});

api("/api/config").then((cfg) => {
  $("#supportLink").href = `https://t.me/${cfg.support_username}`;
}).catch(() => {});

$("#becomeMasterBtn").addEventListener("click", () => {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  $("#registerForm").reset();
  $("#formErrors").classList.add("hidden");
  $("#photoPreviewWrap").classList.add("hidden");
  openModal("registerModal");
});
$("#registerCancelBtn").addEventListener("click", () => closeModal("registerModal"));

$("#regPhoto").addEventListener("change", () => {
  const file = $("#regPhoto").files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $("#photoPreview").src = reader.result;
    $("#photoPreviewWrap").classList.remove("hidden");
    checkPhotoBrightness(reader.result);
  };
  reader.readAsDataURL(file);
});

function checkPhotoBrightness(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const corners = [
      ctx.getImageData(0, 0, 1, 1).data,
      ctx.getImageData(img.width - 1, 0, 1, 1).data,
      ctx.getImageData(0, img.height - 1, 1, 1).data,
      ctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
    ];
    const avg = corners.reduce((sum, c) => sum + (c[0] + c[1] + c[2]) / 3, 0) / corners.length;
    $("#photoWarning").classList.toggle("hidden", avg >= 180);
  };
  img.src = dataUrl;
}

$("#registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#registerSubmitBtn");
  btn.disabled = true; btn.textContent = "Yuborilmoqda...";
  $("#formErrors").classList.add("hidden");
  try {
    const fd = new FormData(e.target);
    fd.set("telegram_id", TG_ID);
    fd.set("telegram_username", TG_USERNAME);
    await api("/api/register", { method: "POST", body: fd });
    closeModal("registerModal");
    toast("✅ Ro'yxatdan muvaffaqiyatli o'tdingiz!");
    loadMasters();
  } catch (err) {
    const el = $("#formErrors");
    const lines = err.message.split("\n").filter(Boolean);
    el.innerHTML = `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
    el.classList.remove("hidden");
  } finally {
    btn.disabled = false; btn.textContent = "Yuborish";
  }
});

$("#myMastersBtn").addEventListener("click", async () => {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  const block = $("#myMastersBlock");
  block.classList.toggle("hidden");
  $("#pendingCallsBlock").classList.add("hidden");
  $("#favBlock").classList.add("hidden");
  if (block.classList.contains("hidden")) return;
  const list = await api(`/api/my-masters/${TG_ID}`);
  $("#myMastersList").innerHTML = list.length ? list.map((m) => `
    <div class="mini-master-row">
      <img src="${m.photo_path}" alt="">
      <div class="mini-master-info">
        <div class="n">${escapeHtml(m.full_name)} <span class="master-code">${m.master_code}</span></div>
        <div class="s">${specialtyOf(m.specialty).name} · ⭐ ${m.avg_rating ? m.avg_rating.toFixed(1) : "—"} (${m.rating_count})</div>
      </div>
      <button class="mini-btn danger" data-id="${m.id}">O'chirish</button>
    </div>`).join("") : `<div class="empty-state"><p>Sizda hali e'lon yo'q</p></div>`;
  $$(".mini-btn.danger", $("#myMastersList")).forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("E'lonni o'chirmoqchimisiz?")) return;
    await api(`/api/masters/${b.dataset.id}/delete`, { method: "POST", body: JSON.stringify({ telegram_id: TG_ID }) });
    toast("E'lon o'chirildi");
    $("#myMastersBtn").click(); $("#myMastersBtn").click();
    loadMasters();
  }));
});

$("#pendingCallsBtn").addEventListener("click", async () => {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  const block = $("#pendingCallsBlock");
  block.classList.toggle("hidden");
  $("#myMastersBlock").classList.add("hidden");
  $("#favBlock").classList.add("hidden");
  if (block.classList.contains("hidden")) return;
  await refreshPendingCalls();
});

async function refreshPendingCalls() {
  if (!TG_ID) return;
  const list = await api(`/api/calls/pending/${TG_ID}`);
  $("#pendingBadge").textContent = list.length;
  $("#pendingBadge").classList.toggle("hidden", list.length === 0);
  $("#pendingCallsList").innerHTML = list.length ? list.map((c) => `
    <div class="mini-master-row">
      <div class="mini-master-info">
        <div class="n">👤 ${escapeHtml(c.customer_name || "Mijoz")}</div>
        <div class="s">📞 ${escapeHtml(c.customer_phone || "—")} ${c.customer_username ? "· @" + escapeHtml(c.customer_username) : ""}</div>
        ${c.note ? `<div class="call-note-text">📝 ${escapeHtml(c.note)}</div>` : ""}
      </div>
      <button class="mini-btn finish" data-id="${c.id}">✅ Tugatdim</button>
    </div>`).join("") : `<div class="empty-state"><p>Hozircha kutilayotgan chaqiruv yo'q</p></div>`;
  $$(".mini-btn.finish", $("#pendingCallsList")).forEach((b) => b.addEventListener("click", async () => {
    await api(`/api/calls/${b.dataset.id}/finish`, { method: "POST", body: JSON.stringify({ master_telegram_id: TG_ID }) });
    toast("Chaqiruv yakunlandi ✅");
    refreshPendingCalls();
  }));
}

$("#favMenuBtn").addEventListener("click", async () => {
  if (!TG_ID) { toast("Botdan kirib, /start bosing"); return; }
  const block = $("#favBlock");
  block.classList.toggle("hidden");
  $("#myMastersBlock").classList.add("hidden");
  $("#pendingCallsBlock").classList.add("hidden");
  if (block.classList.contains("hidden")) return;
  const list = await api(`/api/favorites/${TG_ID}`);
  $("#favList").innerHTML = list.length ? list.map((m) => `
    <div class="mini-master-row">
      <img src="${m.photo_path}" alt="">
      <div class="mini-master-info">
        <div class="n">${escapeHtml(m.full_name)}</div>
        <div class="s">${specialtyOf(m.specialty).name} · ${m.city}</div>
      </div>
    </div>`).join("") : `<div class="empty-state"><p>Saqlangan usta yo'q</p></div>`;
});

$("#favToggleBtn").addEventListener("click", () => { switchView("profile"); $("#favMenuBtn").click(); });

// ------------------------------------------------------------ deep link ----

function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const startParam = tg && tg.initDataUnsafe ? tg.initDataUnsafe.start_param : null;
  const tab = params.get("tab") || startParam;
  const masterId = params.get("master_id");
  if (tab === "rate" && masterId) {
    openRateModal(Number(masterId));
  } else if (tab === "profile") {
    switchView("profile");
  }
}

// ------------------------------------------------------------------ init ----

async function init() {
  await loadUser();
  await loadReference();
  await loadFavorites();
  await loadMasters();
  if (TG_ID) refreshPendingCalls().then(() => {}).catch(() => {});
  handleDeepLink();
}
init();
