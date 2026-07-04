let activeSpecialty = "";
const screens = {
  search: document.getElementById("screen-search"),
  register: document.getElementById("screen-register"),
  profile: document.getElementById("screen-profile"),
};
const tabButtons = document.querySelectorAll(".tabbar__item");

function showTab(name) {
  Object.keys(screens).forEach((key) => {
    if (screens[key]) {
      screens[key].classList.toggle("screen--hidden", key !== name);
    }
  });
  tabButtons.forEach((btn) => {
    btn.classList.toggle("tabbar__item--active", btn.dataset.tab === name);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showTab(btn.dataset.tab);
    if (btn.dataset.tab === "profile") loadProfile();
  });
});

const urlParams = new URLSearchParams(window.location.search);
const initialTab = urlParams.get("tab");
if (initialTab === "register") showTab("register");
if (initialTab === "profile") showTab("profile");

// ---------- DARK / LIGHT THEME ----------
const THEME_KEY = "usta_theme";
const themeToggleBtn = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
  if (themeToggleBtn) {
    themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}
applyTheme(localStorage.getItem(THEME_KEY) || "light");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
    }
  });
}

async function loadReferenceData() {}

function renderMasters(masters) {
  const resultsEl = document.getElementById("mastersResults");
  if (!resultsEl) return;
  resultsEl.innerHTML = "";
  
  masters.forEach((m) => {
    const card = document.createElement("div");
    card.className = "mastercard";
    card.innerHTML = `
      <div class="mastercard__body">
        <h3 class="mastercard__name">${escapeHtml(m.full_name)}</h3>
        <div class="mastercard__meta">
          <span><b>${m.age}</b> yosh</span>
          ${m.price_info ? `<span>${escapeHtml(m.price_info)}</span>` : ""}
          ${renderStarsBadge(m.avg_rating, m.ratings_count)}
        </div>
        ${m.bio ? `<p class="mastercard__bio">${escapeHtml(m.bio)}</p>` : ""}
        <div class="mastercard__actions">
          <a class="mastercard__call" href="tel:${escapeHtml(m.phone.replace(/\s/g, ""))}">📞 Qo'ng'iroq</a>
          <button type="button" class="mastercard__order" data-master-id="${m.id}" data-master-name="${escapeHtml(m.full_name)}">🧾 Buyurtma</button>
          ${m.telegram_username ? `<a class="mastercard__tg" href="https://t.me/${escapeHtml(m.telegram_username)}" target="_blank">✈️ Telegram</a>` : ""}
        </div>
      </div>
    `;
    resultsEl.appendChild(card);
  });

  resultsEl.querySelectorAll(".mastercard__order").forEach((btn) => {
    btn.addEventListener("click", () => openOrderModal(btn.dataset.masterId, btn.dataset.masterName));
  });
}

function renderStarsBadge(avg, count) {
  if (!avg || !count) {
    return `<span class="mastercard__rating mastercard__rating--empty">☆ Hali baholanmagan</span>`;
  }
  return `<span class="mastercard__rating">⭐ ${avg} <em>(${count})</em></span>`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadMyListings() {}

// ---------- ORDER MODAL (buyurtma berish) ----------
const orderModal = document.getElementById("orderModal");
const orderModalBackdrop = document.getElementById("orderModalBackdrop");
const orderModalMaster = document.getElementById("orderModalMaster");
const orderNameInput = document.getElementById("orderName");
const orderPhoneInput = document.getElementById("orderPhone");
const orderAddressInput = document.getElementById("orderAddress");
const orderLocationBtn = document.getElementById("orderLocationBtn");
const orderLocationStatus = document.getElementById("orderLocationStatus");
const orderModalError = document.getElementById("orderModalError");
const orderSubmitBtn = document.getElementById("orderSubmitBtn");
const orderCancelBtn = document.getElementById("orderCancelBtn");
const bonusToast = document.getElementById("bonusToast");

let currentOrderMasterId = null;
let capturedLat = null;
let capturedLon = null;
const tgUser = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe ? window.Telegram.WebApp.initDataUnsafe.user : null;

function openOrderModal(masterId, masterName) {
  currentOrderMasterId = masterId;
  capturedLat = null;
  capturedLon = null;
  if (orderModalMaster) orderModalMaster.textContent = `Usta: ${masterName}`;
  if (orderNameInput) orderNameInput.value = tgUser && tgUser.first_name ? tgUser.first_name : "";
  if (orderPhoneInput) orderPhoneInput.value = "";
  if (orderAddressInput) orderAddressInput.value = "";
  if (orderLocationStatus) orderLocationStatus.textContent = "";
  if (orderModalError) orderModalError.textContent = "";
  if (orderModal) orderModal.classList.remove("modal--hidden");
}

function closeOrderModal() {
  if (orderModal) orderModal.classList.add("modal--hidden");
}

if (orderModalBackdrop) orderModalBackdrop.addEventListener("click", closeOrderModal);
if (orderCancelBtn) orderCancelBtn.addEventListener("click", closeOrderModal);

if (orderLocationBtn) {
  orderLocationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      if (orderLocationStatus) orderLocationStatus.textContent = "Bu qurilmada joylashuvni aniqlab bo'lmadi. Manzilni qo'lda yozing.";
      return;
    }
    if (orderLocationStatus) orderLocationStatus.textContent = "Joylashuv aniqlanmoqda…";
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        capturedLat = pos.coords.latitude;
        capturedLon = pos.coords.longitude;
        if (orderLocationStatus) orderLocationStatus.textContent = "✅ Joylashuvingiz olindi va buyurtmaga qo'shiladi.";
      },
      () => {
        // Har qanday xatolikda faqat toza matn chiqadi, hech qanday ob'ekt qo'shilmaydi
        if (orderLocationStatus) orderLocationStatus.textContent = "Joylashuvga ruxsat berilmadi. Manzilni qo'lda yozishingiz mumkin.";
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

if (orderSubmitBtn) {
  orderSubmitBtn.addEventListener("click", async () => {
    if (orderModalError) orderModalError.textContent = "";
    const phone = orderPhoneInput ? orderPhoneInput.value.trim() : "";
    if (phone.length < 7) {
      if (orderModalError) orderModalError.textContent = "Iltimos, telefon raqamingizni to'g'ri kiriting.";
      return;
    }

    orderSubmitBtn.disabled = true;
    orderSubmitBtn.textContent = "Yuborilmoqda…";

    const fd = new FormData();
    fd.set("master_id", currentOrderMasterId);
    fd.set("customer_name", orderNameInput ? orderNameInput.value.trim() : "");
    fd.set("customer_phone", phone);
    if (orderAddressInput && orderAddressInput.value.trim()) fd.set("address_text", orderAddressInput.value.trim());
    if (capturedLat !== null) fd.set("lat", capturedLat);
    if (capturedLon !== null) fd.set("lon", capturedLon);
    if (tgUser) {
      fd.set("customer_telegram_id", tgUser.id);
      fd.set("customer_username", tgUser.username || "");
    }

    try {
      const res = await fetch("/api/orders", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Xatolik yuz berdi");
      }
      const data = await res.json();
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
      }
      closeOrderModal();
      if (data.bonus) showBonusToast();
    } catch (err) {
      if (orderModalError) orderModalError.textContent = err.message;
    } finally {
      orderSubmitBtn.disabled = false;
      orderSubmitBtn.textContent = "Buyurtmani yuborish";
    }
  });
}

function showBonusToast() {
  if (!bonusToast) return;
  bonusToast.classList.remove("toast--hidden");
  setTimeout(() => bonusToast.classList.add("toast--hidden"), 5000);
}

// ---------- RATING MODAL (baholash) ----------
const rateModal = document.getElementById("rateModal");
const rateModalBackdrop = document.getElementById("rateModalBackdrop");
const rateModalMaster = document.getElementById("rateModalMaster");
const starPicker = document.getElementById("starPicker");
const rateComment = document.getElementById("rateComment");
const rateModalError = document.getElementById("rateModalError");
const rateSubmitBtn = document.getElementById("rateSubmitBtn");
const rateCancelBtn = document.getElementById("rateCancelBtn");

let currentRateOrderId = null;
let currentRateStars = 0;

function openRateModal(orderId, masterName) {
  currentRateOrderId = orderId;
  currentRateStars = 0;
  if (rateModalMaster) rateModalMaster.textContent = `Usta: ${masterName}`;
  if (rateComment) rateComment.value = "";
  if (rateModalError) rateModalError.textContent = "";
  updateStarPicker();
  if (rateModal) rateModal.classList.remove("modal--hidden");
}

function closeRateModal() {
  if (rateModal) rateModal.classList.add("modal--hidden");
}

function updateStarPicker() {
  if (!starPicker) return;
  starPicker.querySelectorAll(".star-picker__star").forEach((btn) => {
    btn.classList.toggle("is-active", Number(btn.dataset.star) <= currentRateStars);
  });
}

if (starPicker) {
  starPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".star-picker__star");
    if (!btn) return;
    currentRateStars = Number(btn.dataset.star);
    updateStarPicker();
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
    }
  });
}

if (rateModalBackdrop) rateModalBackdrop.addEventListener("click", closeRateModal);
if (rateCancelBtn) rateCancelBtn.addEventListener("click", closeRateModal);

if (rateSubmitBtn) {
  rateSubmitBtn.addEventListener("click", async () => {
    if (rateModalError) rateModalError.textContent = "";
    if (!currentRateStars) {
      if (rateModalError) rateModalError.textContent = "Iltimos, yulduzcha orqali baho tanlang.";
      return;
    }
    rateSubmitBtn.disabled = true;
    rateSubmitBtn.textContent = "Yuborilmoqda…";

    const fd = new FormData();
    fd.set("customer_telegram_id", tgUser ? tgUser.id : 0);
    fd.set("stars", currentRateStars);
    if (rateComment && rateComment.value.trim()) fd.set("comment", rateComment.value.trim());

    try {
      const res = await fetch(`/api/orders/${currentRateOrderId}/rate`, { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Xatolik yuz berdi");
      }
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
      }
      closeRateModal();
      loadProfile();
    } catch (err) {
      if (rateModalError) rateModalError.textContent = err.message;
    } finally {
      rateSubmitBtn.disabled = false;
      rateSubmitBtn.textContent = "Baholashni yuborish";
    }
  });
}

// ---------- PROFILE TAB ----------
async function loadProfile() {
  const statsEl = document.getElementById("profileStats");
  const ordersMineEl = document.getElementById("ordersMine");
  const ordersEl = document.getElementById("ordersReceived");
  const listingsEl = document.getElementById("profileListings");

  if (!tgUser) {
    if (statsEl) statsEl.innerHTML = `<p class="empty-hint">Profil faqat Telegram orqali ochilganda ishlaydi.</p>`;
    return;
  }

  try {
    const [statsRes, ordersRes, mineOrdersRes, mineRes] = await Promise.all([
      fetch(`/api/customer-stats/${tgUser.id}`),
      fetch(`/api/orders/received/${tgUser.id}`),
      fetch(`/api/orders/mine/${tgUser.id}`),
      fetch(`/api/my-masters/${tgUser.id}`),
    ]);
    
    const stats = await statsRes.json();
    const orders = await ordersRes.json();
    const myOrders = await mineOrdersRes.json();
    const mine = await mineRes.json();

    if (ordersMineEl) {
      if (!myOrders.length) {
        ordersMineEl.innerHTML = `<p class="empty-hint">Hozircha buyurtma bermagansiz.</p>`;
      } else {
        ordersMineEl.innerHTML = "";
        myOrders.forEach((o) => {
          const row = document.createElement("div");
          row.className = "order-row";
          const date = new Date(o.created_at).toLocaleString("uz-UZ");
          const rated = o.my_rating_stars != null;
          row.innerHTML = `
            <div class="order-row__top">
              <span>🧰 ${escapeHtml(o.master_name)}</span>
              <span>${date}</span>
            </div>
            <div class="order-row__meta">
              ${rated
                ? `<span class="order-row__rated">⭐ Siz baholadingiz: ${o.my_rating_stars}/5 ${o.my_rating_comment ? ` — "${escapeHtml(o.my_rating_comment)}"` : ""}</span>`
                : `<button type="button" class="btn btn--ghost btn--small rate-btn" data-order-id="${o.id}" data-master-name="${escapeHtml(o.master_name)}">⭐ Xizmatni baholash</button>`}
            </div>
          `;
          ordersMineEl.appendChild(row);
        });
        ordersMineEl.querySelectorAll(".rate-btn").forEach((btn) => {
          btn.addEventListener("click", () => openRateModal(btn.dataset.orderId, btn.dataset.masterName));
        });
      }
    }

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="profile-stat">
          <div class="profile-stat__num">${stats.orders_count || 0}</div>
          <div class="profile-stat__label">SIZ BERGAN<br/>BUYURTMALAR</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat__num">${orders.length || 0}</div>
          <div class="profile-stat__label">SIZGA KELGAN<br/>BUYURTMALAR</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat__num">${mine.length || 0}</div>
          <div class="profile-stat__label">FAOL<br/>E'LONLARINGIZ</div>
        </div>
      `;
    }

    if (ordersEl) {
      if (!orders.length) {
        ordersEl.innerHTML = `<p class="empty-hint">Hozircha buyurtma yo'q.</p>`;
      } else {
        ordersEl.innerHTML = "";
        orders.forEach((o) => {
          const row = document.createElement("div");
          row.className = "order-row";
          const date = new Date(o.created_at).toLocaleString("uz-UZ");
          row.innerHTML = `
            <div class="order-row__top">
              <span>${escapeHtml(o.customer_name || "Mijoz")}</span>
              <span>${date}</span>
            </div>
            <div class="order-row__meta">
              📞 <a href="tel:${escapeHtml(o.customer_phone.replace(/\s/g, ""))}">${escapeHtml(o.customer_phone)}</a><br/>
              ${o.address_text ? `📍 ${escapeHtml(o.address_text)}<br/>` : ""}
              ${o.lat && o.lon ? `<a href="https://maps.google.com/?q=${o.lat},${o.lon}" target="_blank">🗺️ Xaritada ko'rish</a><br/>` : ""}
              🧰 ${escapeHtml(o.master_name)}
            </div>
          `;
          ordersEl.appendChild(row);
        });
      }
    }

    if (listingsEl) {
      if (!mine.length) {
        listingsEl.innerHTML = `<p class="empty-hint">Siz hali usta sifatida ro'yxatdan o'tmagansiz.</p>`;
      } else {
        listingsEl.innerHTML = "";
        mine.forEach((m) => {
          const row = document.createElement("div");
          row.className = "my-listing-row";
          row.innerHTML = `
            <span class="my-listing-row__name">${escapeHtml(m.full_name)}</span>
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
          });
        });
      }
    }
  } catch (e) {
    console.error("Profil yuklashda xatolik:", e);
  }
}

// ---------- INIT ----------
(async function init() {
  if (initialTab === "profile") loadProfile();
})();