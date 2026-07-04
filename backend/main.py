import os
import uuid
import shutil

import httpx
from fastapi import FastAPI, Form, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from . import database as db
from .constants import SPECIALTIES, CITIES

BOT_TOKEN = os.getenv("BOT_TOKEN")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
WEBAPP_DIR = os.path.join(BASE_DIR, "webapp")
UPLOADS_DIR = os.path.join(WEBAPP_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 6 * 1024 * 1024  # 6 MB

app = FastAPI(title="Ustalar Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db.init_db()


@app.get("/api/specialties")
def get_specialties():
    return SPECIALTIES


@app.get("/api/cities")
def get_cities():
    return CITIES


@app.get("/api/masters")
def get_masters(
    specialty: str | None = Query(default=None),
    city: str | None = Query(default=None),
    search: str | None = Query(default=None),
):
    rows = db.list_masters(specialty=specialty, city=city, search=search)
    return rows


@app.get("/api/my-masters/{telegram_id}")
def my_masters(telegram_id: int):
    return db.masters_by_telegram_id(telegram_id)


@app.post("/api/register")
async def register_master(
    full_name: str = Form(...),
    age: int = Form(...),
    experience_years: int = Form(...),
    specialty: str = Form(...),
    city: str = Form(...),
    phone: str = Form(...),
    price_info: str | None = Form(default=None),
    bio: str | None = Form(default=None),
    telegram_id: int | None = Form(default=None),
    telegram_username: str | None = Form(default=None),
    photo: UploadFile = File(...),
):
    # --- Validatsiya ---
    if age < 16 or age > 90:
        raise HTTPException(status_code=400, detail="Yosh 16 dan 90 gacha bo'lishi kerak")
    if experience_years < 0 or experience_years > 70:
        raise HTTPException(status_code=400, detail="Tajriba noto'g'ri kiritilgan")
    valid_codes = {s["code"] for s in SPECIALTIES}
    if specialty not in valid_codes:
        raise HTTPException(status_code=400, detail="Soha noto'g'ri tanlangan")
    if city not in CITIES:
        raise HTTPException(status_code=400, detail="Hudud noto'g'ri tanlangan")
    if len(full_name.strip()) < 3:
        raise HTTPException(status_code=400, detail="Ism-familiya juda qisqa")
    if telegram_id and db.masters_by_telegram_id(telegram_id):
        raise HTTPException(
            status_code=400,
            detail="Siz allaqachon usta sifatida ro'yxatdan o'tgansiz. Bitta odam faqat bitta profil ocha oladi. "
                   "Ma'lumotni o'zgartirish uchun avval eski e'loningizni o'chiring, so'ng qaytadan qo'shing."
        )
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Rasm formati JPG, PNG yoki WEBP bo'lishi kerak")

    contents = await photo.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Rasm hajmi 6MB dan oshmasligi kerak")

    ext = os.path.splitext(photo.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOADS_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    new_id = db.add_master({
        "telegram_id": telegram_id,
        "telegram_username": telegram_username,
        "full_name": full_name.strip(),
        "age": age,
        "experience_years": experience_years,
        "specialty": specialty,
        "city": city,
        "phone": phone.strip(),
        "price_info": (price_info or "").strip() or None,
        "bio": (bio or "").strip() or None,
        "photo_path": f"/uploads/{filename}",
    })
    return {"id": new_id, "status": "ok"}


async def notify_master_about_order(master: dict, order: dict):
    """Ustaga yangi buyurtma haqida Telegram orqali xabar yuboradi (best-effort)."""
    if not BOT_TOKEN or not master.get("telegram_id"):
        return
    lines = [
        "🧾 <b>Sizga yangi buyurtma keldi!</b>",
        "",
        f"👤 Mijoz: {order.get('customer_name') or 'Ism ko\u2019rsatilmagan'}",
        f"📞 Telefon: {order['customer_phone']}",
    ]
    if order.get("address_text"):
        lines.append(f"📍 Manzil: {order['address_text']}")
    if order.get("customer_username"):
        lines.append(f"✈️ Telegram: @{order['customer_username']}")
    text = "\n".join(lines)
    api_base = f"https://api.telegram.org/bot{BOT_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(f"{api_base}/sendMessage", json={
                "chat_id": master["telegram_id"],
                "text": text,
                "parse_mode": "HTML",
            })
            if order.get("lat") is not None and order.get("lon") is not None:
                await client.post(f"{api_base}/sendLocation", json={
                    "chat_id": master["telegram_id"],
                    "latitude": order["lat"],
                    "longitude": order["lon"],
                })
    except Exception:
        pass  # Xabar yuborilmasa ham buyurtma saqlanib qoladi


@app.post("/api/orders")
async def create_order(
    master_id: int = Form(...),
    customer_telegram_id: int | None = Form(default=None),
    customer_username: str | None = Form(default=None),
    customer_name: str | None = Form(default=None),
    customer_phone: str = Form(...),
    lat: float | None = Form(default=None),
    lon: float | None = Form(default=None),
    address_text: str | None = Form(default=None),
):
    master = db.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Usta topilmadi")
    if len(customer_phone.strip()) < 7:
        raise HTTPException(status_code=400, detail="Telefon raqami noto'g'ri")

    order_id = db.create_order({
        "master_id": master_id,
        "customer_telegram_id": customer_telegram_id,
        "customer_username": (customer_username or "").strip() or None,
        "customer_name": (customer_name or "").strip() or None,
        "customer_phone": customer_phone.strip(),
        "lat": lat,
        "lon": lon,
        "address_text": (address_text or "").strip() or None,
    })

    orders_count = None
    bonus = False
    if customer_telegram_id:
        orders_count = db.increment_customer_orders(customer_telegram_id)
        bonus = bool(orders_count) and orders_count % 10 == 0

    order = db.get_order(order_id)
    await notify_master_about_order(master, order)

    return {
        "status": "ok",
        "order_id": order_id,
        "orders_count": orders_count,
        "bonus": bonus,
    }


@app.get("/api/customer-stats/{telegram_id}")
def customer_stats(telegram_id: int):
    return {"orders_count": db.get_customer_orders(telegram_id)}


@app.get("/api/orders/received/{telegram_id}")
def orders_received(telegram_id: int):
    return db.list_orders_for_master_telegram(telegram_id)


@app.get("/api/orders/mine/{telegram_id}")
def orders_mine(telegram_id: int):
    """Shu mijoz o'zi bergan buyurtmalar ro'yxati (baholash uchun)."""
    return db.list_orders_by_customer(telegram_id)


@app.post("/api/orders/{order_id}/rate")
async def rate_order(
    order_id: int,
    customer_telegram_id: int = Form(...),
    stars: int = Form(...),
    comment: str | None = Form(default=None),
):
    order = db.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    if order.get("customer_telegram_id") != customer_telegram_id:
        raise HTTPException(status_code=403, detail="Bu buyurtmani baholashga ruxsatingiz yo'q")
    if stars < 1 or stars > 5:
        raise HTTPException(status_code=400, detail="Baho 1 dan 5 gacha bo'lishi kerak")

    new_id = db.add_rating(
        order_id=order_id,
        master_id=order["master_id"],
        customer_telegram_id=customer_telegram_id,
        stars=stars,
        comment=(comment or "").strip() or None,
    )
    if new_id is None:
        raise HTTPException(status_code=400, detail="Bu buyurtma allaqachon baholangan")
    return {"status": "ok", "rating_id": new_id}


@app.post("/api/masters/{master_id}/delete")
def delete_master(master_id: int, telegram_id: int = Form(...)):
    ok = db.deactivate_master(master_id, telegram_id)
    if not ok:
        raise HTTPException(status_code=403, detail="Ruxsat yo'q yoki topilmadi")
    return {"status": "deleted"}


# Statik fayllar: web-app (HTML/CSS/JS) va yuklangan rasmlar
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/", StaticFiles(directory=WEBAPP_DIR, html=True), name="webapp")
