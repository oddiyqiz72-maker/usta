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


def list_masters(specialty: str = None, city: str = None, search: str = None):
    with _lock:
        conn = get_connection()
        query = "SELECT * FROM masters WHERE is_active = 1"
        params = []
        if specialty:
            query += " AND specialty = ?"
            params.append(specialty)
        if city:
            query += " AND city = ?"
            params.append(city)
        if search:
            query += " AND full_name LIKE ?"
            params.append(f"%{search}%")
        query += " ORDER BY experience_years DESC, created_at DESC"
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return [dict(r) for r in rows]


def get_master(master_id: int):
    with _lock:
        conn = get_connection()
        row = conn.execute("SELECT * FROM masters WHERE id = ?", (master_id,)).fetchone()
        conn.close()
        return dict(row) if row else None


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
            "SELECT * FROM masters WHERE telegram_id = ? AND is_active = 1", (telegram_id,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
