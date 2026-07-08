# -*- coding: utf-8 -*-
"""Ustak — SQLite ma'lumotlar bazasi qatlami.

ORM ishlatilmagan — xom SQL. Bitta jarayonda bot va API bir vaqtda
yozishi mumkinligi uchun thread-safe lock qo'llanadi.
"""

import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "ustalar.db"

_lock = threading.Lock()
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn"):
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
    return _local.conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex


def init_db() -> None:
    with _lock:
        conn = _get_conn()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS masters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER NOT NULL,
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
                is_active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id INTEGER NOT NULL,
                customer_telegram_id INTEGER NOT NULL,
                customer_username TEXT,
                customer_name TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                finished_at TEXT,
                FOREIGN KEY (master_id) REFERENCES masters (id)
            );

            CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id INTEGER NOT NULL,
                customer_telegram_id INTEGER NOT NULL,
                stars INTEGER NOT NULL,
                comment TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (master_id) REFERENCES masters (id),
                UNIQUE (master_id, customer_telegram_id)
            );

            CREATE TABLE IF NOT EXISTS customers (
                telegram_id INTEGER PRIMARY KEY,
                telegram_username TEXT,
                full_name TEXT,
                phone TEXT,
                location TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_masters_active ON masters (is_active);
            CREATE INDEX IF NOT EXISTS idx_calls_master ON calls (master_id);
            CREATE INDEX IF NOT EXISTS idx_ratings_master ON ratings (master_id);
            """
        )
        # Eski bazalarda 'location' ustuni bo'lmasligi mumkin — xavfsiz qo'shamiz
        try:
            conn.execute("ALTER TABLE calls ADD COLUMN location TEXT")
        except sqlite3.OperationalError:
            pass
        conn.commit()


# ---------------------------------------------------------------- masters --

def insert_master(data: dict) -> int:
    with _lock:
        conn = _get_conn()
        cur = conn.execute(
            """
            INSERT INTO masters
                (telegram_id, telegram_username, full_name, age, experience_years,
                 specialty, city, phone, price_info, bio, photo_path, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                data["telegram_id"],
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
                now_iso(),
            ),
        )
        conn.commit()
        return cur.lastrowid


def list_masters(specialty: str | None, city: str | None, search: str | None) -> list[sqlite3.Row]:
    conn = _get_conn()
    query = [
        """
        SELECT m.*,
               COALESCE(AVG(r.stars), 0) AS avg_rating,
               COUNT(r.id) AS rating_count
        FROM masters m
        LEFT JOIN ratings r ON r.master_id = m.id
        WHERE m.is_active = 1
        """
    ]
    params: list = []
    if specialty:
        query.append("AND m.specialty = ?")
        params.append(specialty)
    if city:
        query.append("AND m.city = ?")
        params.append(city)
    if search:
        query.append("AND m.full_name LIKE ?")
        params.append(f"%{search}%")
    query.append("GROUP BY m.id ORDER BY avg_rating DESC, m.experience_years DESC, m.created_at DESC")
    return conn.execute(" ".join(query), params).fetchall()


def get_master(master_id: int) -> sqlite3.Row | None:
    conn = _get_conn()
    return conn.execute("SELECT * FROM masters WHERE id = ?", (master_id,)).fetchone()


def list_my_masters(telegram_id: int) -> list[sqlite3.Row]:
    conn = _get_conn()
    return conn.execute(
        """
        SELECT m.*,
               COALESCE(AVG(r.stars), 0) AS avg_rating,
               COUNT(r.id) AS rating_count
        FROM masters m
        LEFT JOIN ratings r ON r.master_id = m.id
        WHERE m.telegram_id = ? AND m.is_active = 1
        GROUP BY m.id
        ORDER BY m.created_at DESC
        """,
        (telegram_id,),
    ).fetchall()


def soft_delete_master(master_id: int, telegram_id: int) -> bool:
    with _lock:
        conn = _get_conn()
        cur = conn.execute(
            "UPDATE masters SET is_active = 0 WHERE id = ? AND telegram_id = ?",
            (master_id, telegram_id),
        )
        conn.commit()
        return cur.rowcount > 0


# ------------------------------------------------------------------ calls --

def insert_call(master_id: int, customer_telegram_id: int, customer_username: str | None,
                 customer_name: str | None, location: str | None = None) -> int:
    with _lock:
        conn = _get_conn()
        cur = conn.execute(
            """
            INSERT INTO calls (master_id, customer_telegram_id, customer_username,
                                customer_name, status, created_at, location)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
            """,
            (master_id, customer_telegram_id, customer_username, customer_name, now_iso(), location),
        )
        conn.commit()
        return cur.lastrowid


def get_call(call_id: int) -> sqlite3.Row | None:
    conn = _get_conn()
    return conn.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()


def list_pending_calls(master_telegram_id: int) -> list[sqlite3.Row]:
    conn = _get_conn()
    return conn.execute(
        """
        SELECT c.* FROM calls c
        JOIN masters m ON m.id = c.master_id
        WHERE m.telegram_id = ? AND c.status = 'pending'
        ORDER BY c.created_at DESC
        """,
        (master_telegram_id,),
    ).fetchall()


def finish_call(call_id: int, master_telegram_id: int) -> sqlite3.Row | None:
    with _lock:
        conn = _get_conn()
        row = conn.execute(
            """
            SELECT c.* FROM calls c
            JOIN masters m ON m.id = c.master_id
            WHERE c.id = ? AND m.telegram_id = ?
            """,
            (call_id, master_telegram_id),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE calls SET status = 'finished', finished_at = ? WHERE id = ?",
            (now_iso(), call_id),
        )
        conn.commit()
        return row


# --------------------------------------------------------------- ratings --

def has_rated(master_id: int, customer_telegram_id: int) -> bool:
    conn = _get_conn()
    row = conn.execute(
        "SELECT 1 FROM ratings WHERE master_id = ? AND customer_telegram_id = ?",
        (master_id, customer_telegram_id),
    ).fetchone()
    return row is not None


def insert_rating(master_id: int, customer_telegram_id: int, stars: int, comment: str | None) -> bool:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                """
                INSERT INTO ratings (master_id, customer_telegram_id, stars, comment, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (master_id, customer_telegram_id, stars, comment, now_iso()),
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False


# -------------------------------------------------------------- customers --

def upsert_customer(telegram_id: int, telegram_username: str | None = None,
                     full_name: str | None = None, phone: str | None = None,
                     location: str | None = None) -> None:
    """Mijoz kontaktini/joylashuvini saqlaydi yoki yangilaydi (faqat berilgan
    maydonlarni yangilaydi, boshqalarini o'chirib yubormaydi)."""
    with _lock:
        conn = _get_conn()
        existing = conn.execute(
            "SELECT * FROM customers WHERE telegram_id = ?", (telegram_id,)
        ).fetchone()
        ts = now_iso()
        if existing:
            conn.execute(
                """
                UPDATE customers SET
                    telegram_username = COALESCE(?, telegram_username),
                    full_name = COALESCE(?, full_name),
                    phone = COALESCE(?, phone),
                    location = COALESCE(?, location),
                    updated_at = ?
                WHERE telegram_id = ?
                """,
                (telegram_username, full_name, phone, location, ts, telegram_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO customers
                    (telegram_id, telegram_username, full_name, phone, location, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (telegram_id, telegram_username, full_name, phone, location, ts, ts),
            )
        conn.commit()


def get_customer(telegram_id: int) -> sqlite3.Row | None:
    conn = _get_conn()
    return conn.execute(
        "SELECT * FROM customers WHERE telegram_id = ?", (telegram_id,)
    ).fetchone()
