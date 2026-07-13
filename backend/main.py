# backend/main.py
"""
USTAK — FastAPI ilovasi.
Barcha API endpointlar + webapp statik fayllarini xizmat qiladi.
Bot bilan bitta jarayonda (run.py, asyncio.gather) ishga tushadi.
"""

import os
import uuid
import base64
from typing import Optional

import httpx
from fastapi import FastAPI, Form, File, UploadFile, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import database as db
from backend.constants import (
    SPECIALTIES, SPECIALTY_MAP, CITIES, AGE_MIN, AGE_MAX,
    EXPERIENCE_MIN, EXPERIENCE_MAX, BIO_MAX_LEN, PRO_PLANS, PRO_BENEFITS,
)
from backend import ai as ai_module

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
ADMIN_IDS = [int(x) for x in os.environ.get("ADMIN_IDS", "").replace(" ", "").split(",") if x]
SUPPORT_USERNAME = os.environ.get("SUPPORT_USERNAME", "ustak_support")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEBAPP_DIR = os.path.join(BASE_DIR, "webapp")
UPLOADS_DIR = os.path.join(WEBAPP_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI(title="USTAK API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init_db()


# ------------------------------------------------------------- telegram ----

async def tg_send_message(chat_id: int, text: str, reply_markup: dict = None):
    """Best-effort: agar BOT_TOKEN yo'q yoki so'rov muvaffaqiyatsiz bo'lsa, jim o'tadi."""
    if not BOT_TOKEN:
        return
    try:
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage", json=payload)
    except Exception:
        pass


def _webapp_inline_button(text: str, tab: str, extra: str = ""):
    if not WEBAPP_URL:
        return None
    url = f"{WEBAPP_URL}?tab={tab}{extra}"
    return {"inline_keyboard": [[{"text": text, "web_app": {"url": url}}]]}


# ------------------------------------------------------------ reference ----

@app.get("/api/specialties")
def get_specialties():
    return SPECIALTIES


@app.get("/api/cities")
def get_cities():
    return CITIES


@app.get("/api/config")
def get_config():
    return {"support_username": SUPPORT_USERNAME}


@app.get("/api/pro-plans")
def get_pro_plans():
    return {"plans": PRO_PLANS, "benefits": PRO_BENEFITS}


# ---------------------------------------------------------------- users ----

@app.get("/api/user/{telegram_id}")
def get_user(telegram_id: int):
    user = db.get_user(telegram_id)
    if not user:
        raise HTTPException(404, "Foydalanuvchi topilmadi. Avval botga /start yuboring.")
    return user


@app.post("/api/user/{telegram_id}/prefs")
def update_prefs(telegram_id: int, dark_mode: Optional[int] = Body(None), animations: Optional[int] = Body(None)):
    db.update_user_prefs(telegram_id, dark_mode, animations)
    return {"ok": True}


# -------------------------------------------------------------- masters ----

@app.get("/api/masters")
def api_search_masters(specialty: str = None, city: str = None, search: str = None):
    return db.search_masters(specialty, city, search)


@app.get("/api/masters/{master_id}")
def api_get_master(master_id: int):
    m = db.get_master(master_id)
    if not m:
        raise HTTPException(404, "Usta topilmadi")
    return m


@app.get("/api/masters/{master_id}/stats")
def api_master_stats(master_id: int):
    return db.get_master_stats(master_id)


@app.get("/api/my-masters/{telegram_id}")
def api_my_masters(telegram_id: int):
    return db.get_my_masters(telegram_id)


def _validate_registration(full_name, age, experience_years, specialty, city, phone, bio):
    errors = []
    if not full_name or len(full_name.strip()) < 2:
        errors.append("Ism kiritilishi shart (kamida 2 belgi)")
    if not (AGE_MIN <= age <= AGE_MAX):
        errors.append(f"Yosh {AGE_MIN}-{AGE_MAX} oralig'ida bo'lishi kerak")
    if not (EXPERIENCE_MIN <= experience_years <= EXPERIENCE_MAX):
        errors.append(f"Tajriba {EXPERIENCE_MIN}-{EXPERIENCE_MAX} yil oralig'ida bo'lishi kerak")
    if specialty not in SPECIALTY_MAP:
        errors.append("Noto'g'ri soha tanlandi")
    if city not in CITIES:
        errors.append("Noto'g'ri hudud tanlandi")
    if not phone or len(phone.strip()) < 7:
        errors.append("Telefon raqam kiritilishi shart")
    if bio and len(bio) > BIO_MAX_LEN:
        errors.append(f"Bio {BIO_MAX_LEN} belgidan oshmasligi kerak")
    return errors


@app.post("/api/register")
async def api_register(
    telegram_id: int = Form(...),
    telegram_username: str = Form(""),
    full_name: str = Form(...),
    age: int = Form(...),
    experience_years: int = Form(...),
    specialty: str = Form(...),
    city: str = Form(...),
    phone: str = Form(...),
    price_info: str = Form(""),
    bio: str = Form(""),
    photo: UploadFile = File(...),
):
    errors = _validate_registration(full_name, age, experience_years, specialty, city, phone, bio)
    if not photo or not photo.content_type or not photo.content_type.startswith("image/"):
        errors.append("Rasm fayli yuklanishi shart")
    if errors:
        raise HTTPException(422, {"detail": errors})

    ext = os.path.splitext(photo.filename or "")[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOADS_DIR, fname)
    content = await photo.read()
    with open(fpath, "wb") as f:
        f.write(content)

    master_id = db.create_master({
        "telegram_id": telegram_id,
        "telegram_username": telegram_username,
        "full_name": full_name.strip(),
        "age": age,
        "experience_years": experience_years,
        "specialty": specialty,
        "city": city,
        "phone": phone.strip(),
        "price_info": price_info.strip() or None,
        "bio": bio.strip() or None,
        "photo_path": f"/uploads/{fname}",
    })
    master = db.get_master(master_id)

    await tg_send_message(
        telegram_id,
        f"✅ Tabriklaymiz, <b>{full_name}</b>!\n"
        f"Siz <b>{SPECIALTY_MAP[specialty]['name']}</b> sifatida ro'yxatdan o'tdingiz.\n"
        f"Sizning usta ID: <b>{master['master_code']}</b>\n\n"
        f"Endi mijozlar sizni qidiruvda topa oladi va chaqiruv yubora oladi. "
        f"Har bir chaqiruv haqida shu yerga xabar keladi.",
    )
    return master


@app.post("/api/masters/{master_id}/delete")
def api_delete_master(master_id: int, telegram_id: int = Body(..., embed=True)):
    ok = db.delete_master(master_id, telegram_id)
    if not ok:
        raise HTTPException(403, "Bu e'lon sizga tegishli emas")
    return {"ok": True}


# ---------------------------------------------------------------- calls ----

class CallIn(BaseModel):
    master_id: int
    customer_telegram_id: int
    customer_username: Optional[str] = ""
    customer_name: Optional[str] = ""
    customer_phone: Optional[str] = ""
    note: Optional[str] = Field(None, max_length=300)


@app.post("/api/calls")
async def api_create_call(payload: CallIn):
    master = db.get_master(payload.master_id)
    if not master:
        raise HTTPException(404, "Usta topilmadi")

    call_id = db.create_call(
        payload.master_id, payload.customer_telegram_id, payload.customer_username,
        payload.customer_name, payload.customer_phone, payload.note,
    )

    contact_line = f"📞 <b>{payload.customer_phone}</b>" if payload.customer_phone else "📞 raqam mavjud emas"
    username_line = f"\n✈️ @{payload.customer_username}" if payload.customer_username else ""
    note_line = f"\n📝 {payload.note}" if payload.note else ""
    customer_name = payload.customer_name or "Noma'lum"

    await tg_send_message(
        master["telegram_id"],
        f"🔔 <b>Yangi chaqiruv!</b>\n\n"
        f"👤 Mijoz: <b>{customer_name}</b>\n"
        f"{contact_line}{username_line}{note_line}\n\n"
        f"Mijoz bilan bog'laning va ishni tugatgach, ilovada \"✅ Tugatdim\" tugmasini bosing.",
        reply_markup=_webapp_inline_button("📋 Chaqiruvlarni ko'rish", "profile"),
    )
    return {"ok": True, "call_id": call_id}


@app.get("/api/calls/pending/{master_telegram_id}")
def api_pending_calls(master_telegram_id: int):
    return db.get_pending_calls(master_telegram_id)


@app.post("/api/calls/{call_id}/finish")
async def api_finish_call(call_id: int, master_telegram_id: int = Body(..., embed=True)):
    call = db.finish_call(call_id, master_telegram_id)
    if not call:
        raise HTTPException(403, "Bu chaqiruv sizga tegishli emas")

    master = db.get_master(call["master_id"])
    if call["customer_telegram_id"]:
        await tg_send_message(
            call["customer_telegram_id"],
            f"✅ <b>{master['full_name']}</b> chaqiruvni bajarilgan deb belgiladi.\n\n"
            f"Xizmat sifatini baholab, boshqa mijozlarga yordam bering ⭐",
            reply_markup=_webapp_inline_button("⭐ Baholash", "rate", f"&master_id={master['id']}"),
        )
    return {"ok": True}


# -------------------------------------------------------------- ratings ----

class RatingIn(BaseModel):
    customer_telegram_id: int
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=300)


@app.post("/api/masters/{master_id}/rate")
async def api_rate_master(master_id: int, payload: RatingIn):
    if db.has_rated(master_id, payload.customer_telegram_id):
        raise HTTPException(409, "Siz bu ustani allaqachon baholagansiz")
    ok = db.add_rating(master_id, payload.customer_telegram_id, payload.stars, payload.comment)
    if not ok:
        raise HTTPException(409, "Siz bu ustani allaqachon baholagansiz")

    master = db.get_master(master_id)
    if master:
        stars_str = "⭐" * payload.stars
        await tg_send_message(
            master["telegram_id"],
            f"🌟 Sizga yangi baho qo'yildi: {stars_str}\n"
            f"{'💬 ' + payload.comment if payload.comment else ''}",
        )
    return {"ok": True}


@app.get("/api/masters/{master_id}/has-rated/{telegram_id}")
def api_has_rated(master_id: int, telegram_id: int):
    return {"has_rated": db.has_rated(master_id, telegram_id)}


# ------------------------------------------------------------ favorites ----

@app.post("/api/favorites/toggle")
def api_toggle_favorite(customer_telegram_id: int = Body(...), master_id: int = Body(...)):
    saved = db.toggle_favorite(customer_telegram_id, master_id)
    return {"saved": saved}


@app.get("/api/favorites/{telegram_id}")
def api_get_favorites(telegram_id: int):
    return db.get_favorites(telegram_id)


# --------------------------------------------------------------- pro ----

@app.post("/api/pro/request")
async def api_pro_request(master_id: int = Body(...), plan_code: str = Body(...), telegram_id: int = Body(...)):
    master = db.get_master(master_id)
    plan = next((p for p in PRO_PLANS if p["code"] == plan_code), None)
    if not master or not plan:
        raise HTTPException(404, "Ma'lumot topilmadi")
    if master["telegram_id"] != telegram_id:
        raise HTTPException(403, "Ruxsat yo'q")

    for admin_id in ADMIN_IDS:
        await tg_send_message(
            admin_id,
            f"💳 <b>Yangi PRO so'rov</b>\n"
            f"Usta: {master['full_name']} ({master['master_code']})\n"
            f"Reja: {plan['name']} — {plan['price_uzs']:,} so'm\n"
            f"Tasdiqlash: <code>/pro_confirm {master['master_code']} {plan['days']}</code>",
        )
    await tg_send_message(
        telegram_id,
        f"📨 PRO obuna so'rovingiz ({plan['name']}) qabul qilindi. "
        f"To'lov bo'yicha tez orada operator siz bilan bog'lanadi.",
    )
    return {"ok": True}


# ------------------------------------------------------------------ AI ----

class AIChatIn(BaseModel):
    messages: list
    image_base64: Optional[str] = None
    image_media_type: Optional[str] = None


@app.post("/api/ai/chat")
async def api_ai_chat(payload: AIChatIn):
    reply = await ai_module.ask_ai(payload.messages, payload.image_base64, payload.image_media_type)
    return {"reply": reply}


# ------------------------------------------------------------- static ----

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/assets", StaticFiles(directory=WEBAPP_DIR), name="assets")


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(WEBAPP_DIR, "index.html"))


@app.get("/{path:path}")
def serve_static_or_index(path: str):
    fpath = os.path.join(WEBAPP_DIR, path)
    if os.path.isfile(fpath):
        return FileResponse(fpath)
    return FileResponse(os.path.join(WEBAPP_DIR, "index.html"))
