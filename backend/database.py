"""
Ustalar bazasi bilan ishlash uchun oddiy SQLite qatlami.
Thread-safe qilish uchun lock ishlatiladi (SQLite bitta faylga yozish uchun).
"""
import sqlite3
import threading
import os
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "ustalar.db")
_lock = threading.Lock()


def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _lock:
        conn = get_connection()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS masters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER,
                telegram_username TEXT,
                full_name TEXT NOT NULL,
                age INTEGER NOT NULL,
                experience_years INTEGER NOT NULL,
                specialty TEXT NOT NULL,
                city TEXT NOT NULL,
                phone TEXT NOT NULL,
                price_info TEXT,
                bio TEXT,
                photo_path TEXT,
                created_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id INTEGER NOT NULL,
                customer_telegram_id INTEGER,
                customer_username TEXT,
                customer_name TEXT,
                customer_phone TEXT NOT NULL,
                lat REAL,
                lon REAL,
                address_text TEXT,
                created_at TEXT NOT NULL,
                status TEXT DEFAULT 'new'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS customer_stats (
                telegram_id INTEGER PRIMARY KEY,
                orders_count INTEGER DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL UNIQUE,
                master_id INTEGER NOT NULL,
                customer_telegram_id INTEGER,
                stars INTEGER NOT NULL,
                comment TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()


def add_master(data: dict) -> int:
    with _lock:
        conn = get_connection()
        cur = conn.execute("""
            INSERT INTO masters
            (telegram_id, telegram_username, full_name, age, experience_years,
             specialty, city, phone, price_info, bio, photo_path, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            data.get("telegram_id"),
            data.get("telegram_username"),
            data["full_name"],
            data["age"],
            data["experience_years"],
            data["specialty"],
            data["city"],
            data["phone"],
            data.get("price_info"),
            data.get("bio"),
            data.get("photo_path"),
            datetime.now(timezone.utc).isoformat(),
        ))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return new_id


RATING_JOIN_SQL = """
    LEFT JOIN (
        SELECT master_id, AVG(stars) AS avg_rating, COUNT(*) AS ratings_count
        FROM ratings GROUP BY master_id
    ) r ON r.master_id = m.id
"""


def _attach_rating_defaults(row: dict) -> dict:
    row["avg_rating"] = round(row["avg_rating"], 1) if row.get("avg_rating") is not None else None
    row["ratings_count"] = row.get("ratings_count") or 0
    return row


def list_masters(specialty: str = None, city: str = None, search: str = None):
    with _lock:
        conn = get_connection()
        query = f"SELECT m.*, r.avg_rating, r.ratings_count FROM masters m {RATING_JOIN_SQL} WHERE m.is_active = 1"
        params = []
        if specialty:
            query += " AND m.specialty = ?"
            params.append(specialty)
        if city:
            query += " AND m.city = ?"
            params.append(city)
        if search:
            query += " AND m.full_name LIKE ?"
            params.append(f"%{search}%")
        query += " ORDER BY r.avg_rating DESC, m.experience_years DESC, m.created_at DESC"
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return [_attach_rating_defaults(dict(r)) for r in rows]


def get_master(master_id: int):
    with _lock:
        conn = get_connection()
        row = conn.execute(
            f"SELECT m.*, r.avg_rating, r.ratings_count FROM masters m {RATING_JOIN_SQL} WHERE m.id = ?",
            (master_id,)
        ).fetchone()
        conn.close()
        return _attach_rating_defaults(dict(row)) if row else None


def deactivate_master(master_id: int, telegram_id: int) -> bool:
    """Faqat o'z profilini o'chirishga ruxsat beriladi."""
    with _lock:
        conn = get_connection()
        cur = conn.execute(
            "UPDATE masters SET is_active = 0 WHERE id = ? AND telegram_id = ?",
            (master_id, telegram_id)
        )
        conn.commit()
        changed = cur.rowcount > 0
        conn.close()
        return changed


def masters_by_telegram_id(telegram_id: int):
    with _lock:
        conn = get_connection()
        rows = conn.execute(
            f"SELECT m.*, r.avg_rating, r.ratings_count FROM masters m {RATING_JOIN_SQL} "
            "WHERE m.telegram_id = ? AND m.is_active = 1",
            (telegram_id,)
        ).fetchall()
        conn.close()
        return [_attach_rating_defaults(dict(r)) for r in rows]


# ---------- BUYURTMALAR (ORDERS) ----------

def create_order(data: dict) -> int:
    with _lock:
        conn = get_connection()
        cur = conn.execute("""
            INSERT INTO orders
            (master_id, customer_telegram_id, customer_username, customer_name,
             customer_phone, lat, lon, address_text, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
        """, (
            data["master_id"],
            data.get("customer_telegram_id"),
            data.get("customer_username"),
            data.get("customer_name"),
            data["customer_phone"],
            data.get("lat"),
            data.get("lon"),
            data.get("address_text"),
            datetime.now(timezone.utc).isoformat(),
        ))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return new_id


def get_order(order_id: int):
    with _lock:
        conn = get_connection()
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        conn.close()
        return dict(row) if row else None


def list_orders_for_master_telegram(telegram_id: int):
    """Shu telegram_id'ga tegishli barcha usta e'lonlariga kelgan buyurtmalar."""
    with _lock:
        conn = get_connection()
        rows = conn.execute("""
            SELECT o.*, m.full_name AS master_name, m.specialty AS master_specialty
            FROM orders o
            JOIN masters m ON o.master_id = m.id
            WHERE m.telegram_id = ?
            ORDER BY o.created_at DESC
        """, (telegram_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]


# ---------- MIJOZ STATISTIKASI (LOYALTY) ----------

def increment_customer_orders(telegram_id: int):
    """Mijoz necha marta buyurtma berganini +1 qilib, yangi sonni qaytaradi."""
    with _lock:
        conn = get_connection()
        conn.execute("""
            INSERT INTO customer_stats (telegram_id, orders_count) VALUES (?, 1)
            ON CONFLICT(telegram_id) DO UPDATE SET orders_count = orders_count + 1
        """, (telegram_id,))
        conn.commit()
        row = conn.execute(
            "SELECT orders_count FROM customer_stats WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        conn.close()
        return row["orders_count"] if row else None


def get_customer_orders(telegram_id: int) -> int:
    with _lock:
        conn = get_connection()
        row = conn.execute(
            "SELECT orders_count FROM customer_stats WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        conn.close()
        return row["orders_count"] if row else 0


def list_orders_by_customer(telegram_id: int):
    """Shu mijoz bergan barcha buyurtmalar, allaqachon baholanganini ko'rsatgan holda."""
    with _lock:
        conn = get_connection()
        rows = conn.execute("""
            SELECT o.*, m.full_name AS master_name, m.specialty AS master_specialty,
                   rt.stars AS my_rating_stars, rt.comment AS my_rating_comment
            FROM orders o
            JOIN masters m ON o.master_id = m.id
            LEFT JOIN ratings rt ON rt.order_id = o.id
            WHERE o.customer_telegram_id = ?
            ORDER BY o.created_at DESC
        """, (telegram_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]


# ---------- BAHOLASH (RATINGS) ----------

def add_rating(order_id: int, master_id: int, customer_telegram_id: int, stars: int, comment: str = None):
    with _lock:
        conn = get_connection()
        existing = conn.execute(
            "SELECT id FROM ratings WHERE order_id = ?", (order_id,)
        ).fetchone()
        if existing:
            conn.close()
            return None  # allaqachon baholangan
        cur = conn.execute("""
            INSERT INTO ratings (order_id, master_id, customer_telegram_id, stars, comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            order_id, master_id, customer_telegram_id, stars, comment,
            datetime.now(timezone.utc).isoformat(),
        ))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return new_id
