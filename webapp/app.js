// ============================================================
// Ustalar Mini App — frontend logic
// ============================================================
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
}

const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;

let SPECIALTIES = [];
let CITIES = [];
let activeSpecialty = "";

// ---------- TAB SWITCHING ----------
const screens = {
  search: document.getElementById("screen-search"),
  register: document.getElementById("screen-register"),
  profile: document.getElementById("screen-profile"),
};
const tabButtons = document.querySelectorAll(".tabbar__item");

function showTab(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("screen--hidden", key !== name);
  });
  tabButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === name);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showTab(btn.dataset.tab);
    if (btn.dataset.tab === "profile") loadProfile();
  });
});

// Open tab based on ?tab= param sent from the bot's WebApp buttons
const urlParams = new URLSearchParams(window.location.search);
const initialTab = urlParams.get("tab");
if (initialTab === "register") showTab("register");
if (initialTab === "profile") showTab("profile");

// ---------- DARK / LIGHT THEME ----------
const THEME_KEY = "usta_theme";
const themeToggleBtn = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");
themeToggleBtn.addEventListener("click", () => {
  const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
});

// ---------- LOAD REFERENCE DATA ----------
async function loadReferenceData() {
  const [specRes, cityRes] = await Promise.all([
    fetch("/api/specialties"),
    fetch("/api/cities"),
  ]);
  SPECIALTIES = await specRes.json();
  CITIES = await cityRes.json();

  renderSpecialtyChips();
  renderSelectOptions();
}

function renderSpecialtyChips() {
  const container = document.getElementById("specialtyChips");
  container.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.className = "chip is-active";
  allChip.textContent = "Hammasi";
  allChip.dataset.code = "";
  container.appendChild(allChip);

  SPECIALTIES.forEach((s) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = `${s.emoji} ${s.label}`;
    chip.dataset.code = s.code;
    container.appendChild(chip);
  });

  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    container.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    activeSpecialty = chip.dataset.code;
    fetchAndRenderMasters();
  });
}

function renderSelectOptions() {
  const citySelect = document.getElementById("cityFilter");
  const citySelectForm = document.getElementById("citySelect");
  const specialtySelectForm = document.getElementById("specialtySelect");

  CITIES.forEach((c) => {
    citySelect.appendChild(new Option(c, c));
    citySelectForm.appendChild(new Option(c, c));
  });

  SPECIALTIES.forEach((s) => {
    specialtySelectForm.appendChild(new Option(`${s.emoji} ${s.label}`, s.code));
  });
}

// ---------- SEARCH / RESULTS ----------
const resultsEl = document.getElementById("results");
const searchInput = document.getElementById("searchInput");
const cityFilter = document.getElementById("cityFilter");

function specialtyLabel(code) {
  const s = SPECIALTIES.find((x) => x.code === code);
  return s ? `${s.emoji} ${s.label}` : code;
}

async function fetchAndRenderMasters() {
  const params = new URLSearchParams();
  if (activeSpecialty) params.set("specialty", activeSpecialty);
  if (cityFilter.value) params.set("city", cityFilter.value);
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());

  const res = await fetch(`/api/masters?${params.toString()}`);
  const masters = await res.json();
  renderMasters(masters);
}

function renderMasters(masters) {
  resultsEl.innerHTML = "";
  if (!masters.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔎</div>
        <p>Hozircha hech kim topilmadi.<br/>Filtrni o'zgartirib ko'ring.</p>
      </div>`;
    return;
  }

  masters.forEach((m) => {
    const card = document.createElement("div");
    card.className = "mastercard";
    card.innerHTML = `
      <img class="mastercard__photo" src="${m.photo_path}" alt="${escapeHtml(m.full_name)}" />
      <div class="mastercard__body">
        <div class="mastercard__top">
          <div>
            <p class="mastercard__name">${escapeHtml(m.full_name)}</p>
            <p class="mastercard__specialty">${specialtyLabel(m.specialty)} · ${escapeHtml(m.city)}</p>
          </div>
          <span class="mastercard__stamp">${m.experience_years} YIL TAJRIBA</span>
        </div>
        <div class="mastercard__meta">
          <span><b>${m.age}</b> yosh</span>
          ${m.price_info ? `<span>${escapeHtml(m.price_info)}</span>` : ""}
          ${renderStarsBadge(m.avg_rating, m.ratings_count)}
        </div>
        ${m.bio ? `<p class="mastercard__bio">${escapeHtml(m.bio)}</p>` : ""}
        <div class="mastercard__actions">
          <a class="mastercard__call" href="tel:${escapeHtml(m.phone.replace(/\s/g, ""))}">📞 Qo'ng'iroq</a>
          <button type="button" class="mastercard__order" data-master-id="${m.id}" data-master-name="${escapeHtml(m.full_name)}">⭐ Baholash</button>
          ${m.telegram_username ? `<a class="mastercard__tg" href="https://t.me/${escapeHtml(m.telegram_username)}" target="_blank">✈️</a>` : ""}
        </div>
      </div>
    `;
    resultsEl.appendChild(card);
  });

  resultsEl.querySelectorAll(".mastercard__order").forEach((btn) => {
    btn.addEventListener("click", () => openRateModal(btn.dataset.masterId, btn.dataset.masterName));
  });
}

function renderStarsBadge(avg, count) {
  if (!avg || !count) {
    return `<span class="mastercard__rating mastercard__rating--empty">☆ Hali baholanmagan</span>`;
  }
  return `<span class="mastercard__rating">⭐ ${avg} <em>(${count})</em></span>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

searchInput.addEventListener("input", debounce(fetchAndRenderMasters, 350));
cityFilter.addEventListener("change", fetchAndRenderMasters);

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- PHOTO UPLOAD + WHITE BACKGROUND CHECK ----------
const photoInput = document.getElementById("photoInput");
const photoPreview = document.getElementById("photoPreview");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const photoWarning = document.getElementById("photoWarning");
const photoOverride = document.getElementById("photoOverride");

let photoBackgroundOk = false;

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreview.src = e.target.result;
    photoPreview.classList.remove("photo-drop__preview--hidden");
    photoPlaceholder.style.display = "none";
    checkWhiteBackground(e.target.result);
  };
  reader.readAsDataURL(file);
});

function checkWhiteBackground(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const w = (canvas.width = 60);
    const h = (canvas.height = 60);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    // Sample the 4 corners (approx background area, ~8x8px each)
    const regions = [
      [0, 0], [w - 8, 0], [0, h - 8], [w - 8, h - 8],
    ];
    let total = 0, count = 0;
    regions.forEach(([x, y]) => {
      const data = ctx.getImageData(x, y, 8, 8).data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        total += lum;
        count++;
      }
    });
    const avgLum = total / count;
    photoBackgroundOk = avgLum >= 195;
    photoWarning.classList.toggle("photo-warning--hidden", photoBackgroundOk);
    if (!photoBackgroundOk) photoOverride.checked = false;
  };
  img.src = dataUrl;
}

// ---------- FORM SUBMIT ----------
const form = document.getElementById("regForm");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const regSuccess = document.getElementById("regSuccess");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";

  if (!photoInput.files[0]) {
    formError.textContent = "Iltimos, rasmingizni yuklang.";
    return;
  }
  if (!photoBackgroundOk && !photoOverride.checked) {
    formError.textContent = "Rasm foni oq emas. Boshqa rasm tanlang yoki 'Baribir yuborish' belgisini bosing.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Yuborilmoqda…";

  const formData = new FormData(form);
  formData.set("photo", photoInput.files[0]);
  if (tgUser) {
    formData.set("telegram_id", tgUser.id);
    formData.set("telegram_username", tgUser.username || "");
  }

  try {
    const res = await fetch("/api/register", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(extractErrorMessage(err));
    }
    form.classList.add("screen--hidden");
    regSuccess.classList.remove("success-box--hidden");
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    loadMyListings();
  } catch (err) {
    formError.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "E'lonni joylash";
  }
});

document.getElementById("backToFormBtn").addEventListener("click", () => {
  form.reset();
  photoPreview.classList.add("photo-drop__preview--hidden");
  photoPlaceholder.style.display = "flex";
  photoWarning.classList.add("photo-warning--hidden");
  photoBackgroundOk = false;
  form.classList.remove("screen--hidden");
  regSuccess.classList.add("success-box--hidden");
});

// ---------- MY LISTINGS ----------
async function loadMyListings() {
  if (!tgUser) return;
  const container = document.getElementById("myListings");
  const res = await fetch(`/api/my-masters/${tgUser.id}`);
  const mine = await res.json();
  if (!mine.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `<p class="my-listings__title">Mening e'lonlarim</p>`;
  mine.forEach((m) => {
    const row = document.createElement("div");
    row.className = "my-listing-row";
    row.innerHTML = `
      <span class="my-listing-row__name">${escapeHtml(m.full_name)} · ${specialtyLabel(m.specialty)}</span>
      <button class="my-listing-row__del" data-id="${m.id}">O'chirish</button>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll(".my-listing-row__del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const fd = new FormData();
      fd.set("telegram_id", tgUser.id);
      await fetch(`/api/masters/${btn.dataset.id}/delete`, { method: "POST", body: fd });
      loadMyListings();
      fetchAndRenderMasters();
    });
  });
}

function extractErrorMessage(errData) {
  const d = errData && errData.detail;
  if (!d) return "Xatolik yuz berdi";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((item) => item.msg || JSON.stringify(item)).join("; ");
  if (typeof d === "object") return JSON.stringify(d);
  return "Xatolik yuz berdi";
}

// ---------- RATING MODAL (to'g'ridan-to'g'ri usta kartochkasidan baholash) ----------
const rateModal = document.getElementById("rateModal");
const rateModalBackdrop = document.getElementById("rateModalBackdrop");
const rateModalMaster = document.getElementById("rateModalMaster");
const starPicker = document.getElementById("starPicker");
const rateComment = document.getElementById("rateComment");
const rateModalError = document.getElementById("rateModalError");
const rateSubmitBtn = document.getElementById("rateSubmitBtn");
const rateCancelBtn = document.getElementById("rateCancelBtn");

let currentRateMasterId = null;
let currentRateStars = 0;

function openRateModal(masterId, masterName) {
  if (!tgUser) {
    alert("Baholash faqat Telegram ilovasi ichida ishlaydi.");
    return;
  }
  currentRateMasterId = masterId;
  currentRateStars = 0;
  rateModalMaster.textContent = `Usta: ${masterName}`;
  rateComment.value = "";
  rateModalError.textContent = "";
  updateStarPicker();
  rateModal.classList.remove("modal--hidden");
}

function closeRateModal() {
  rateModal.classList.add("modal--hidden");
}

function updateStarPicker() {
  starPicker.querySelectorAll(".star-picker__star").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.star) <= currentRateStars);
  });
}

starPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".star-picker__star");
  if (!btn) return;
  currentRateStars = Number(btn.dataset.star);
  updateStarPicker();
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred("light");
});

rateModalBackdrop.addEventListener("click", closeRateModal);
rateCancelBtn.addEventListener("click", closeRateModal);

rateSubmitBtn.addEventListener("click", async () => {
  rateModalError.textContent = "";
  if (!currentRateStars) {
    rateModalError.textContent = "Iltimos, yulduzcha orqali baho tanlang.";
    return;
  }
  rateSubmitBtn.disabled = true;
  rateSubmitBtn.textContent = "Yuborilmoqda…";

  const fd = new FormData();
  fd.set("customer_telegram_id", tgUser.id);
  fd.set("stars", currentRateStars);
  if (rateComment.value.trim()) fd.set("comment", rateComment.value.trim());

  try {
    const res = await fetch(`/api/masters/${currentRateMasterId}/rate`, { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(extractErrorMessage(err));
    }
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
    closeRateModal();
    fetchAndRenderMasters();
  } catch (err) {
    rateModalError.textContent = err.message;
  } finally {
    rateSubmitBtn.disabled = false;
    rateSubmitBtn.textContent = "Baholashni yuborish";
  }
});

// ---------- PROFILE TAB ----------
async function loadProfile() {
  const listingsEl = document.getElementById("profileListings");
  if (!tgUser || !listingsEl) return;

  const res = await fetch(`/api/my-masters/${tgUser.id}`);
  const mine = await res.json();

  if (!mine.length) {
    listingsEl.innerHTML = `<p class="empty-hint">Siz hali usta sifatida ro'yxatdan o'tmagansiz.</p>`;
  } else {
    listingsEl.innerHTML = "";
    mine.forEach((m) => {
      const row = document.createElement("div");
      row.className = "my-listing-row";
      row.innerHTML = `
        <span class="my-listing-row__name">${escapeHtml(m.full_name)} · ${specialtyLabel(m.specialty)}</span>
        <button class="my-listing-row__del" data-id="${m.id}">O'chirish</button>
      `;
      listingsEl.appendChild(row);
    });
    listingsEl.querySelectorAll(".my-listing-row__del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const fd = new FormData();
        fd.set("telegram_id", tgUser.id);
        await fetch(`/api/masters/${btn.dataset.id}/delete`, { method: "POST", body: fd });
        loadProfile();
        loadMyListings();
        fetchAndRenderMasters();
      });
    });
  }
}

// ---------- INIT ----------
(async function init() {
  await loadReferenceData();
  await fetchAndRenderMasters();
  await loadMyListings();
  if (initialTab === "profile") loadProfile();
})();
