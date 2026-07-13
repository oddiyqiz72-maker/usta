# backend/database.py
"""
USTAK — SQLite bilan ishlash qatlami.
Xom SQL ishlatiladi (ORM yo'q). Barcha yozish amallari thread-safe lock bilan himoyalangan,
chunki FastAPI + aiogram bitta jarayonda (run.py) ishlaydi va bir nechta thread/async task
bir vaqtda bazaga murojaat qilishi mumkin.
"""

import sqlite3
import threading
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "ustalar.db")
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with _lock:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            full_name TEXT,
            phone TEXT,
            contact_shared_at TEXT,
            dark_mode INTEGER DEFAULT 1,
            animations INTEGER DEFAULT 1,
            created_at TEXT
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS masters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            master_code TEXT UNIQUE,
            telegram_id INTEGER,
            telegram_username TEXT,
            full_name TEXT NOT NULL,
            age INTEGER,
            experience_years INTEGER,
            specialty TEXT NOT NULL,
            city TEXT NOT NULL,
            phone TEXT NOT NULL,
            price_info TEXT,
            bio TEXT,
            photo_path TEXT,
            is_pro INTEGER DEFAULT 0,
            pro_until TEXT,
            created_at TEXT,
            is_active INTEGER DEFAULT 1
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id INTEGER NOT NULL,
            customer_telegram_id INTEGER,
            customer_username TEXT,
            customer_name TEXT,
            customer_phone TEXT,
            note TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            finished_at TEXT,
            FOREIGN KEY (master_id) REFERENCES masters(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            master_id INTEGER NOT NULL,
            customer_telegram_id INTEGER NOT NULL,
            stars INTEGER NOT NULL,
            comment TEXT,
            created_at TEXT,
            UNIQUE(master_id, customer_telegram_id),
            FOREIGN KEY (master_id) REFERENCES masters(id)
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_telegram_id INTEGER NOT NULL,
            master_id INTEGER NOT NULL,
            created_at TEXT,
            UNIQUE(customer_telegram_id, master_id)
        )
        """)

        conn.commit()
        conn.close()


# ---------------------------------------------------------------- users ----

def upsert_user_contact(telegram_id: int, username: str, full_name: str, phone: str):
    with _lock:
        conn = get_conn()
        conn.execute("""
            INSERT INTO users (telegram_id, username, full_name, phone, contact_shared_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                username=excluded.username,
                full_name=excluded.full_name,
                phone=excluded.phone,
                contact_shared_at=excluded.contact_shared_at
        """, (telegram_id, username, full_name, phone, _now(), _now()))
        conn.commit()
        conn.close()


def get_user(telegram_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE telegram_id=?", (telegram_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_user_prefs(telegram_id: int, dark_mode: int = None, animations: int = None):
    with _lock:
        conn = get_conn()
        if dark_mode is not None:
            conn.execute("UPDATE users SET dark_mode=? WHERE telegram_id=?", (dark_mode, telegram_id))
        if animations is not None:
            conn.execute("UPDATE users SET animations=? WHERE telegram_id=?", (animations, telegram_id))
        conn.commit()
        conn.close()


# -------------------------------------------------------------- masters ----

def _gen_master_code(cur) -> str:
    row = cur.execute("SELECT COUNT(*) as c FROM masters").fetchone()
    n = (row["c"] if row else 0) + 1
    return f"US-{1000 + n}"


def create_master(data: dict) -> int:
    with _lock:
        conn = get_conn()
        cur = conn.cursor()
        code = _gen_master_code(cur)
        cur.execute("""
            INSERT INTO masters (
                master_code, telegram_id, telegram_username, full_name, age,
                experience_years, specialty, city, phone, price_info, bio,
                photo_path, created_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            code, data["telegram_id"], data.get("telegram_username"), data["full_name"],
            data["age"], data["experience_years"], data["specialty"], data["city"],
            data["phone"], data.get("price_info"), data.get("bio"), data.get("photo_path"),
            _now()
        ))
        conn.commit()
        master_id = cur.lastrowid
        conn.close()
        return master_id


_MASTER_SELECT = """
    SELECT
        m.*,
        COALESCE(AVG(r.stars), 0) AS avg_rating,
        COUNT(DISTINCT r.id) AS rating_count
    FROM masters m
    LEFT JOIN ratings r ON r.master_id = m.id
"""


def search_masters(specialty: str = None, city: str = None, search: str = None):
    conn = get_conn()
    q = _MASTER_SELECT + " WHERE m.is_active = 1"
    params = []
    if specialty:
        q += " AND m.specialty = ?"
        params.append(specialty)
    if city:
        q += " AND m.city = ?"
        params.append(city)
    if search:
        q += " AND m.full_name LIKE ?"
        params.append(f"%{search}%")
    q += " GROUP BY m.id ORDER BY m.is_pro DESC, avg_rating DESC, m.created_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_master(master_id: int):
    conn = get_conn()
    q = _MASTER_SELECT + " WHERE m.id = ? GROUP BY m.id"
    row = conn.execute(q, (master_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_my_masters(telegram_id: int):
    conn = get_conn()
    q = _MASTER_SELECT + " WHERE m.telegram_id = ? AND m.is_active = 1 GROUP BY m.id ORDER BY m.created_at DESC"
    rows = conn.execute(q, (telegram_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_master(master_id: int, telegram_id: int) -> bool:
    with _lock:
        conn = get_conn()
        row = conn.execute("SELECT telegram_id FROM masters WHERE id=?", (master_id,)).fetchone()
        if not row or row["telegram_id"] != telegram_id:
            conn.close()
            return False
        conn.execute("UPDATE masters SET is_active=0 WHERE id=?", (master_id,))
        conn.commit()
        conn.close()
        return True


def get_master_by_code(master_code: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM masters WHERE master_code=?", (master_code,)).fetchone()
    conn.close()
    return dict(row) if row else None


def set_master_pro(master_id: int, days: int):
    with _lock:
        conn = get_conn()
        conn.execute(
            "UPDATE masters SET is_pro=1, pro_until=datetime('now', ?) WHERE id=?",
            (f"+{days} days", master_id)
        )
        conn.commit()
        conn.close()


# ---------------------------------------------------------------- calls ----

def create_call(master_id: int, customer_telegram_id: int, customer_username: str,
                 customer_name: str, customer_phone: str, note: str = None) -> int:
    with _lock:
        conn = get_conn()
        cur = conn.execute("""
            INSERT INTO calls (master_id, customer_telegram_id, customer_username,
                                customer_name, customer_phone, note, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        """, (master_id, customer_telegram_id, customer_username, customer_name,
              customer_phone, note, _now()))
        conn.commit()
        call_id = cur.lastrowid
        conn.close()
        return call_id


def get_pending_calls(master_telegram_id: int):
    conn = get_conn()
    rows = conn.execute("""
        SELECT c.*, m.full_name AS master_name
        FROM calls c
        JOIN masters m ON m.id = c.master_id
        WHERE m.telegram_id = ? AND c.status = 'pending'
        ORDER BY c.created_at DESC
    """, (master_telegram_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def finish_call(call_id: int, master_telegram_id: int):
    with _lock:
        conn = get_conn()
        row = conn.execute("""
            SELECT c.*, m.telegram_id AS owner_id FROM calls c
            JOIN masters m ON m.id = c.master_id WHERE c.id = ?
        """, (call_id,)).fetchone()
        if not row or row["owner_id"] != master_telegram_id:
            conn.close()
            return None
        conn.execute("UPDATE calls SET status='finished', finished_at=? WHERE id=?", (_now(), call_id))
        conn.commit()
        conn.close()
        return dict(row)


def get_call(call_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM calls WHERE id=?", (call_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


# -------------------------------------------------------------- ratings ----

def add_rating(master_id: int, customer_telegram_id: int, stars: int, comment: str = None):
    with _lock:
        conn = get_conn()
        try:
            conn.execute("""
                INSERT INTO ratings (master_id, customer_telegram_id, stars, comment, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (master_id, customer_telegram_id, stars, comment, _now()))
            conn.commit()
            ok = True
        except sqlite3.IntegrityError:
            ok = False
        conn.close()
        return ok


def has_rated(master_id: int, customer_telegram_id: int) -> bool:
    conn = get_conn()
    row = conn.execute(
        "SELECT 1 FROM ratings WHERE master_id=? AND customer_telegram_id=?",
        (master_id, customer_telegram_id)
    ).fetchone()
    conn.close()
    return row is not None


# ------------------------------------------------------------ favorites ----

def toggle_favorite(customer_telegram_id: int, master_id: int) -> bool:
    """Qaytaradi: True — saqlandi, False — o'chirildi."""
    with _lock:
        conn = get_conn()
        row = conn.execute(
            "SELECT id FROM favorites WHERE customer_telegram_id=? AND master_id=?",
            (customer_telegram_id, master_id)
        ).fetchone()
        if row:
            conn.execute("DELETE FROM favorites WHERE id=?", (row["id"],))
            conn.commit()
            conn.close()
            return False
        conn.execute(
            "INSERT INTO favorites (customer_telegram_id, master_id, created_at) VALUES (?, ?, ?)",
            (customer_telegram_id, master_id, _now())
        )
        conn.commit()
        conn.close()
        return True


def get_favorites(customer_telegram_id: int):
    conn = get_conn()
    q = _MASTER_SELECT + """
        JOIN favorites f ON f.master_id = m.id
        WHERE f.customer_telegram_id = ? AND m.is_active = 1
        GROUP BY m.id ORDER BY f.created_at DESC
    """
    rows = conn.execute(q, (customer_telegram_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ------------------------------------------------------------ statistics ----

def get_master_stats(master_id: int):
    conn = get_conn()
    calls_total = conn.execute("SELECT COUNT(*) c FROM calls WHERE master_id=?", (master_id,)).fetchone()["c"]
    calls_finished = conn.execute(
        "SELECT COUNT(*) c FROM calls WHERE master_id=? AND status='finished'", (master_id,)
    ).fetchone()["c"]
    rating = conn.execute(
        "SELECT COALESCE(AVG(stars),0) a, COUNT(*) c FROM ratings WHERE master_id=?", (master_id,)
    ).fetchone()
    conn.close()
    return {
        "calls_total": calls_total,
        "calls_finished": calls_finished,
        "avg_rating": round(rating["a"], 2),
        "rating_count": rating["c"],
    }
