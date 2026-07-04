require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const db = require('./db');
const products = require('./products');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID;
const CARD_NUMBER = process.env.CARD_NUMBER || '0000 0000 0000 0000';
const CARD_HOLDER = process.env.CARD_HOLDER || '';
const MIN_TOPUP = parseInt(process.env.MIN_TOPUP || '10000', 10);
const MAX_TOPUP = parseInt(process.env.MAX_TOPUP || '2000000', 10);
const SMS_SECRET = process.env.SMS_SECRET || '';
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`; // https URL required by Telegram in production

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN yo\'q! .env faylini to\'ldiring.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Telegram WebApp initData tekshirish (xavfsizlik uchun) ----------
function verifyInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckArr = [];
  for (const [key, value] of [...urlParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computedHash !== hash) return null;
  const userJson = urlParams.get('user');
  return userJson ? JSON.parse(userJson) : null;
}

function auth(req, res, next) {
  const initData = req.headers['x-telegram-init-data'];
  const user = verifyInitData(initData || '');
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.tgUser = user;
  next();
}

// ---------- API ----------
app.get('/api/me', auth, (req, res) => {
  const user = db.getUser(req.tgUser.id, req.tgUser.username);
  res.json({ balance: user.balance, username: user.username });
});

app.get('/api/products', (req, res) => {
  res.json({ games: products.games, apps: products.apps });
});

app.get('/api/config', (req, res) => {
  res.json({ card: CARD_NUMBER, cardHolder: CARD_HOLDER, min: MIN_TOPUP, max: MAX_TOPUP });
});

app.get('/api/orders', auth, (req, res) => {
  res.json({ orders: db.getUserOrders(req.tgUser.id) });
});

// Balansni to'ldirish so'rovi -> admin guruhga yuboriladi
app.post('/api/topup', auth, async (req, res) => {
  const amount = parseInt(req.body.amount, 10);
  if (!amount || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return res.status(400).json({ error: 'invalid_amount' });
  }
  db.getUser(req.tgUser.id, req.tgUser.username);
  const topupId = db.createTopup(req.tgUser.id, amount);

  const text =
    `🧾 <b>Yangi to'lov so'rovi</b>\n\n` +
    `👤 Foydalanuvchi: @${req.tgUser.username || 'no_username'} (ID: ${req.tgUser.id})\n` +
    `💰 Summa: <b>${amount.toLocaleString('ru-RU')} so'm</b>\n` +
    `#topup${topupId}`;

  const msg = await bot.telegram.sendMessage(ADMIN_GROUP_ID, text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Tasdiqlash', `topup_ok_${topupId}`)],
      [Markup.button.callback('❌ Rad etish', `topup_no_${topupId}`)],
    ]),
  });
  db.setTopupAdminMsg(topupId, msg.message_id);
  res.json({ ok: true, topupId });
});

// Xarid qilish -> balansdan yechiladi va admin guruhga yuboriladi
app.post('/api/order', auth, async (req, res) => {
  const { gameId, productId, playerId, serverId, mode, days } = req.body;
  const product = products.findProduct(gameId, productId);
  if (!product) return res.status(400).json({ error: 'invalid_product' });
  if (!playerId) return res.status(400).json({ error: 'player_id_required' });
  if (product.game.needsServerId && !serverId) {
    return res.status(400).json({ error: 'server_id_required' });
  }

  let price = product.price;
  let orderMode = 'buy';
  let orderDays = null;
  if (product.game.isNft) {
    orderMode = mode === 'rent' ? 'rent' : 'buy';
    if (orderMode === 'rent') {
      orderDays = Math.max(1, parseInt(days || 1, 10));
      price = product.rentPricePerDay * orderDays;
    } else {
      price = product.buyPrice;
    }
  }

  const user = db.getUser(req.tgUser.id, req.tgUser.username);
  if (user.balance < price) {
    return res.status(400).json({ error: 'insufficient_balance' });
  }

  db.deductBalance(req.tgUser.id, price);
  const orderId = db.createOrder({
    tg_id: req.tgUser.id,
    game_id: gameId,
    product_id: productId,
    product_title: product.title,
    price,
    player_id: playerId,
    server_id: serverId || null,
    mode: orderMode,
    days: orderDays,
  });

  const modeLine = product.game.isNft
    ? `📌 Turi: ${orderMode === 'rent' ? `Ijaraga (${orderDays} kun)` : 'Sotib olish'}\n`
    : '';

  const text =
    `🛒 <b>Yangi buyurtma</b>\n\n` +
    `👤 @${req.tgUser.username || 'no_username'} (ID: ${req.tgUser.id})\n` +
    `🎮 Bo'lim: ${product.game.title}\n` +
    `📦 Mahsulot: ${product.title}\n` +
    modeLine +
    `💵 Narx: <b>${price.toLocaleString('ru-RU')} so'm</b>\n` +
    `🆔 ${product.game.idLabel || 'Player ID'}: <code>${playerId}</code>\n` +
    (serverId ? `🌐 Server ID: <code>${serverId}</code>\n` : '') +
    `#order${orderId}`;

  const msg = await bot.telegram.sendMessage(ADMIN_GROUP_ID, text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Bajarildi', `order_ok_${orderId}`)],
      [Markup.button.callback('❌ Bekor qilish (pulni qaytar)', `order_no_${orderId}`)],
    ]),
  });
  db.setOrderAdminMsg(orderId, msg.message_id);

  res.json({ ok: true, orderId, newBalance: user.balance - price });
});

// ---------- To'lovni tasdiqlash (admin tugmasi yoki SMS orqali chaqiriladi) ----------
async function approveTopup(id) {
  const topup = db.getTopup(id);
  if (!topup || topup.status !== 'pending') return false;
  db.addBalance(topup.tg_id, topup.amount);
  db.setTopupStatus(id, 'approved');
  if (topup.admin_msg_id) {
    try {
      await bot.telegram.editMessageText(
        ADMIN_GROUP_ID,
        topup.admin_msg_id,
        undefined,
        `🧾 To'lov #${id} — ${topup.amount.toLocaleString('ru-RU')} so'm\n\n✅ TASDIQLANDI (SMS orqali avtomatik)`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }
  await bot.telegram.sendMessage(
    topup.tg_id,
    `✅ Balansingiz ${topup.amount.toLocaleString('ru-RU')} so'mga to'ldirildi!`
  );
  return true;
}

// SMS forwarder ilova shu manzilga POST qiladi: { text, sender }
// Sozlash: README.md dagi "SMS orqali avtomatik to'lov" bo'limiga qarang
app.post('/api/sms/webhook', async (req, res) => {
  if (!SMS_SECRET || req.query.secret !== SMS_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const text = (req.body.text || '').toString();
  // Summani ajratib olish: "25 000 so'm", "25000 UZS", "+25,000" kabi formatlarni qamrab oladi
  const match = text.replace(/\u00A0/g, ' ').match(/([\d][\d\s,.]{2,})\s*(so'?m|som|uzs)/i);
  if (!match) {
    await bot.telegram.sendMessage(
      ADMIN_GROUP_ID,
      `📩 Yangi SMS keldi, lekin summani aniqlab bo'lmadi:\n\n<code>${text}</code>`,
      { parse_mode: 'HTML' }
    );
    return res.json({ ok: true, matched: false });
  }
  const amount = parseInt(match[1].replace(/[\s,.]/g, ''), 10);

  const pending = db.db
    .prepare("SELECT * FROM topups WHERE status = 'pending' AND amount = ? ORDER BY id ASC LIMIT 1")
    .get(amount);

  if (!pending) {
    await bot.telegram.sendMessage(
      ADMIN_GROUP_ID,
      `📩 SMS orqali <b>${amount.toLocaleString('ru-RU')} so'm</b> tushdi, lekin mos kutilayotgan to'lov topilmadi. Qo'lda tekshiring:\n\n<code>${text}</code>`,
      { parse_mode: 'HTML' }
    );
    return res.json({ ok: true, matched: false });
  }

  await approveTopup(pending.id);
  res.json({ ok: true, matched: true, topupId: pending.id });
});

// ---------- Admin guruhdagi tugmalar ----------
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const isAdminChat = String(ctx.chat.id) === String(ADMIN_GROUP_ID);
  if (!isAdminChat) return ctx.answerCbQuery();

  if (data.startsWith('topup_ok_') || data.startsWith('topup_no_')) {
    const id = parseInt(data.split('_')[2], 10);
    const topup = db.getTopup(id);
    if (!topup || topup.status !== 'pending') return ctx.answerCbQuery('Allaqachon ko\'rib chiqilgan');

    if (data.startsWith('topup_ok_')) {
      await approveTopup(id);
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ TASDIQLANDI', { parse_mode: 'HTML' });
    } else {
      db.setTopupStatus(id, 'rejected');
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ RAD ETILDI', { parse_mode: 'HTML' });
      await bot.telegram.sendMessage(topup.tg_id, `❌ To'lovingiz tasdiqlanmadi. Admin bilan bog'laning.`);
    }
    return ctx.answerCbQuery('OK');
  }

  if (data.startsWith('order_ok_') || data.startsWith('order_no_')) {
    const id = parseInt(data.split('_')[2], 10);
    const order = db.getOrder(id);
    if (!order || order.status !== 'pending') return ctx.answerCbQuery('Allaqachon ko\'rib chiqilgan');

    if (data.startsWith('order_ok_')) {
      db.setOrderStatus(id, 'done');
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ BAJARILDI', { parse_mode: 'HTML' });
      await bot.telegram.sendMessage(order.tg_id, `✅ Buyurtmangiz (#${id}) bajarildi. Rahmat!`);
    } else {
      db.addBalance(order.tg_id, order.price); // pulni qaytarish
      db.setOrderStatus(id, 'rejected');
      await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ BEKOR QILINDI, PUL QAYTARILDI', {
        parse_mode: 'HTML',
      });
      await bot.telegram.sendMessage(
        order.tg_id,
        `❌ Buyurtmangiz (#${id}) bekor qilindi, pulingiz balansga qaytarildi.`
      );
    }
    return ctx.answerCbQuery('OK');
  }
});

// ---------- /start - Mini App tugmasi ----------
bot.start((ctx) => {
  db.getUser(ctx.from.id, ctx.from.username);
  ctx.reply(
    "🎮 Global Donat botiga xush kelibsiz!\n\nO'yin uchun UC/Diamond sotib olish uchun quyidagi tugmani bosing:",
    Markup.inlineKeyboard([Markup.button.webApp("🚀 Ochish", PUBLIC_URL)])
  );
});

bot.launch();
app.listen(PORT, () => console.log(`Server ${PORT}-portda ishlamoqda, WebApp: ${PUBLIC_URL}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
