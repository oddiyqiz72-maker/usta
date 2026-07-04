const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const initData = tg?.initData || '';

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'error');
    err.data = data;
    throw err;
  }
  return data;
}

function fmt(n) {
  return Number(n).toLocaleString('ru-RU');
}

function showSnackbar(text) {
  const el = document.getElementById('snackbar');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Navigation ----------
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  const tab = document.querySelector(`.tab[data-tab="${id}"]`);
  if (tab) tab.classList.add('active');
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    showScreen(t.dataset.tab);
    if (t.dataset.tab === 'screen-history') loadOrders();
    if (t.dataset.tab === 'screen-profile') loadProfile();
  });
});
document.querySelectorAll('[data-back]').forEach((b) => {
  b.addEventListener('click', () => showScreen(b.dataset.back));
});

// ---------- State ----------
let state = {
  balance: 0,
  username: '',
  games: [],
  apps: [],
  activeSeg: 'games',
  currentGame: null,
  currentProduct: null,
  nftMode: 'buy',
  config: { card: '', cardHolder: '', min: 10000, max: 2000000 },
};

async function loadMe() {
  const me = await api('/api/me');
  state.balance = me.balance;
  state.username = me.username;
  document.getElementById('balanceValue').textContent = fmt(me.balance);
}

async function loadProducts() {
  const { games, apps } = await api('/api/products');
  state.games = games;
  state.apps = apps;
  renderGameGrid();
}

function renderGameGrid() {
  const list = state.activeSeg === 'games' ? state.games : state.apps;
  const grid = document.getElementById('gameGrid');
  grid.innerHTML = '';
  list.forEach((g) => {
    const card = document.createElement('button');
    card.className = 'game-card';
    card.innerHTML = `<img class="icon" src="${g.icon}" alt="" />
      <div class="name">${g.title}</div>
      <div class="tag">⚡ Avto</div>`;
    card.addEventListener('click', () => openGame(g.id));
    grid.appendChild(card);
  });
}

document.querySelectorAll('.seg-btn').forEach((b) => {
  b.addEventListener('click', () => {
    state.activeSeg = b.dataset.seg;
    document.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    renderGameGrid();
  });
});

function openGame(gameId) {
  const game = [...state.games, ...state.apps].find((g) => g.id === gameId);
  state.currentGame = game;
  document.getElementById('gameHeaderInfo').innerHTML = `
    <img class="icon" src="${game.icon}" alt="" style="width:36px;height:36px;border-radius:10px" />
    <div class="name">${game.title}</div>`;
  const list = document.getElementById('productList');
  list.innerHTML = '';
  game.products.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'product-item';
    const priceLabel = game.isNft
      ? `${fmt(p.buyPrice)} so'm`
      : `${fmt(p.price)} so'm`;
    item.innerHTML = `
      <div class="left"><img class="icon" src="${p.icon || game.icon}" alt="" /><span class="title">${p.title}</span></div>
      <span class="price">${priceLabel}</span>`;
    item.addEventListener('click', () => openCheckout(p));
    list.appendChild(item);
  });
  showScreen('screen-products');
}

function openCheckout(product) {
  state.currentProduct = product;
  state.nftMode = 'buy';
  const game = state.currentGame;

  document.getElementById('checkoutIcon').src = product.icon || game.icon;
  document.getElementById('checkoutTitle').textContent = product.title;
  document.getElementById('playerIdLabel').textContent = game.idLabel || 'Player ID';
  document.getElementById('playerIdInput').value = '';
  document.getElementById('serverIdInput').value = '';
  document.getElementById('serverIdField').style.display = game.needsServerId ? 'block' : 'none';

  document.getElementById('nftModeBox').style.display = game.isNft ? 'flex' : 'none';
  document.getElementById('rentDaysField').style.display = 'none';
  document.getElementById('modeBuyBtn').classList.add('active');
  document.getElementById('modeRentBtn').classList.remove('active');
  document.getElementById('rentDaysInput').value = 1;

  updateCheckoutPrice();
  showScreen('screen-checkout');
}

function updateCheckoutPrice() {
  const p = state.currentProduct;
  const game = state.currentGame;
  let price;
  if (game.isNft) {
    if (state.nftMode === 'buy') {
      price = p.buyPrice;
    } else {
      const days = Math.max(1, parseInt(document.getElementById('rentDaysInput').value || '1', 10));
      price = p.rentPricePerDay * days;
    }
  } else {
    price = p.price;
  }
  document.getElementById('checkoutPrice').textContent = fmt(price) + " so'm";
  return price;
}

document.getElementById('modeBuyBtn').addEventListener('click', () => {
  state.nftMode = 'buy';
  document.getElementById('modeBuyBtn').classList.add('active');
  document.getElementById('modeRentBtn').classList.remove('active');
  document.getElementById('rentDaysField').style.display = 'none';
  updateCheckoutPrice();
});
document.getElementById('modeRentBtn').addEventListener('click', () => {
  state.nftMode = 'rent';
  document.getElementById('modeRentBtn').classList.add('active');
  document.getElementById('modeBuyBtn').classList.remove('active');
  document.getElementById('rentDaysField').style.display = 'block';
  updateCheckoutPrice();
});
document.getElementById('rentDaysInput').addEventListener('input', updateCheckoutPrice);

document.getElementById('confirmOrderBtn').addEventListener('click', async () => {
  const playerId = document.getElementById('playerIdInput').value.trim();
  const serverId = document.getElementById('serverIdInput').value.trim();
  const game = state.currentGame;
  if (!playerId) return showSnackbar(`${game.idLabel || 'Player ID'} kiriting`);
  if (game.needsServerId && !serverId) return showSnackbar('Server ID kiriting');

  const price = updateCheckoutPrice();
  const days = game.isNft && state.nftMode === 'rent'
    ? Math.max(1, parseInt(document.getElementById('rentDaysInput').value || '1', 10))
    : undefined;

  if (state.balance < price) {
    showSnackbar("❌ Mablag' yetarli emas! Balansni to'ldiring.");
    openTopupModal();
    return;
  }

  try {
    const res = await api('/api/order', {
      method: 'POST',
      body: JSON.stringify({
        gameId: game.id,
        productId: state.currentProduct.id,
        playerId,
        serverId,
        mode: game.isNft ? state.nftMode : undefined,
        days,
      }),
    });
    state.balance = res.newBalance;
    document.getElementById('balanceValue').textContent = fmt(state.balance);
    showSnackbar('✅ Buyurtma qabul qilindi! Tez orada bajariladi.');
    showScreen('screen-home');
  } catch (e) {
    if (e.data?.error === 'insufficient_balance') {
      showSnackbar("❌ Mablag' yetarli emas! Balansni to'ldiring.");
      openTopupModal();
    } else {
      showSnackbar('Xatolik yuz berdi, qayta urinib ko\'ring');
    }
  }
});

// ---------- History ----------
async function loadOrders() {
  const { orders } = await api('/api/orders');
  const list = document.getElementById('orderList');
  list.innerHTML = '';
  if (!orders.length) {
    list.innerHTML = '<div class="empty-state">Hali buyurtma yo\'q</div>';
    return;
  }
  orders.forEach((o) => {
    const div = document.createElement('div');
    div.className = 'order-item';
    const statusLabel = { pending: 'Kutilmoqda', done: 'Bajarildi', rejected: 'Bekor qilindi' }[o.status];
    div.innerHTML = `
      <div class="row"><span class="title">${o.product_title}</span><span>${fmt(o.price)} so'm</span></div>
      <span class="status ${o.status}">${statusLabel}</span>`;
    list.appendChild(div);
  });
}

// ---------- Profile ----------
async function loadProfile() {
  document.getElementById('profileName').textContent = state.username ? '@' + state.username : 'Foydalanuvchi';
  document.getElementById('avatarInitial').textContent = (state.username || 'U')[0].toUpperCase();
  document.getElementById('profileBalance').textContent = fmt(state.balance);
}
document.getElementById('profileTopupBtn').addEventListener('click', openTopupModal);

// ---------- Topup modal ----------
function openTopupModal() {
  document.getElementById('minMaxHint').textContent =
    `Min: ${fmt(state.config.min)} · Max: ${fmt(state.config.max)} UZS`;
  document.getElementById('topupAmount').value = '';
  document.getElementById('topupBackdrop').classList.add('open');
}
document.getElementById('openTopup').addEventListener('click', openTopupModal);
document.getElementById('closeTopup').addEventListener('click', () =>
  document.getElementById('topupBackdrop').classList.remove('open')
);
document.querySelectorAll('.chip').forEach((c) => {
  c.addEventListener('click', () => {
    document.getElementById('topupAmount').value = c.dataset.amt;
  });
});

document.getElementById('payBtn').addEventListener('click', async () => {
  const amount = parseInt(document.getElementById('topupAmount').value, 10);
  if (!amount || amount < state.config.min || amount > state.config.max) {
    showSnackbar(`Summa ${fmt(state.config.min)} - ${fmt(state.config.max)} oralig'ida bo'lishi kerak`);
    return;
  }
  try {
    await api('/api/topup', { method: 'POST', body: JSON.stringify({ amount }) });
    document.getElementById('topupBackdrop').classList.remove('open');
    document.getElementById('waitAmount').textContent = fmt(amount) + " UZS";
    document.getElementById('cardBox').innerHTML = `<span>${state.config.card}</span><span class="copy" id="copyCard">📋</span>`;
    document.getElementById('waitBackdrop').classList.add('open');
    document.getElementById('copyCard').addEventListener('click', () => {
      navigator.clipboard?.writeText(state.config.card.replace(/\s/g, ''));
      showSnackbar('Nusxalandi');
    });
  } catch (e) {
    showSnackbar('Xatolik yuz berdi, qayta urinib ko\'ring');
  }
});

document.getElementById('waitOkBtn').addEventListener('click', () => {
  document.getElementById('waitBackdrop').classList.remove('open');
  showSnackbar('So\'rovingiz adminga yuborildi, tez orada tasdiqlanadi ✅');
  // Balansni bir necha soniyadan keyin yangilab turamiz (admin tasdiqlagach)
  let tries = 0;
  const iv = setInterval(async () => {
    tries++;
    await loadMe();
    if (tries > 20) clearInterval(iv);
  }, 4000);
});

// ---------- Init ----------
(async function init() {
  try {
    state.config = await api('/api/config');
    await loadMe();
    await loadProducts();
  } catch (e) {
    showSnackbar('Botni Telegram ichida oching');
  }
})();
