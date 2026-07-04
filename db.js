const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  tg_id INTEGER PRIMARY KEY,
  username TEXT,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_msg_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id INTEGER NOT NULL,
  game_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  price INTEGER NOT NULL,
  player_id TEXT,
  server_id TEXT,
  mode TEXT DEFAULT 'buy',
  days INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | rejected
  admin_msg_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function getUser(tgId, username) {
  let user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgId);
  if (!user) {
    db.prepare('INSERT INTO users (tg_id, username, balance) VALUES (?, ?, 0)').run(tgId, username || '');
    user = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(tgId);
  }
  return user;
}

function addBalance(tgId, amount) {
  db.prepare('UPDATE users SET balance = balance + ? WHERE tg_id = ?').run(amount, tgId);
}

function deductBalance(tgId, amount) {
  db.prepare('UPDATE users SET balance = balance - ? WHERE tg_id = ?').run(amount, tgId);
}

function createTopup(tgId, amount) {
  const info = db.prepare('INSERT INTO topups (tg_id, amount) VALUES (?, ?)').run(tgId, amount);
  return info.lastInsertRowid;
}

function setTopupAdminMsg(id, msgId) {
  db.prepare('UPDATE topups SET admin_msg_id = ? WHERE id = ?').run(msgId, id);
}

function getTopup(id) {
  return db.prepare('SELECT * FROM topups WHERE id = ?').get(id);
}

function setTopupStatus(id, status) {
  db.prepare('UPDATE topups SET status = ? WHERE id = ?').run(status, id);
}

function createOrder(order) {
  const info = db
    .prepare(
      `INSERT INTO orders (tg_id, game_id, product_id, product_title, price, player_id, server_id, mode, days)
       VALUES (@tg_id, @game_id, @product_id, @product_title, @price, @player_id, @server_id, @mode, @days)`
    )
    .run({ mode: 'buy', days: null, ...order });
  return info.lastInsertRowid;
}

function setOrderAdminMsg(id, msgId) {
  db.prepare('UPDATE orders SET admin_msg_id = ? WHERE id = ?').run(msgId, id);
}

function getOrder(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

function setOrderStatus(id, status) {
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
}

function getUserOrders(tgId) {
  return db.prepare('SELECT * FROM orders WHERE tg_id = ? ORDER BY id DESC LIMIT 30').all(tgId);
}

module.exports = {
  db,
  getUser,
  addBalance,
  deductBalance,
  createTopup,
  setTopupAdminMsg,
  getTopup,
  setTopupStatus,
  createOrder,
  setOrderAdminMsg,
  getOrder,
  setOrderStatus,
  getUserOrders,
};
