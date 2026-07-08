# -*- coding: utf-8 -*-
"""Ustak — FastAPI ilovasi.

Barcha REST API endpointlar + Mini App statik fayllarini xizmat qilish
shu yerda joylashgan.
"""

import asyncio
import os
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, Form, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend import database as db
from backend.constants import SPECIALTIES, CITIES, specialty_label

BASE_DIR = Path(__file__).resolve().parent.parent
WEBAPP_DIR = BASE_DIR / "webapp"
UPLOADS_DIR = WEBAPP_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# Usta "Tugatdim" bosgandan necha soniyadan keyin mijozga fikr-mulohaza
# xabari yuborilishi (standart — 10 daqiqa)
FEEDBACK_DELAY_SECONDS = int(os.environ.get("FEEDBACK_DELAY_SECONDS", 600))

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6MB

app = FastAPI(title="Ustak API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


# --------------------------------------------------------------- helpers --

async def notify_telegram(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    """Botga xabar yuborish — best-effort, xato bo'lsa jim o'tadi."""
    if not BOT_TOKEN:
        return
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{TELEGRAM_API}/sendMessage", json=payload)
    except Exception:
        pass


def master_to_dict(row) -> dict:
    d = dict(row)
    d["specialty_label"] = specialty_label(d.get("specialty", ""))
    d["avg_rating"] = round(d.get("avg_rating") or 0, 1)
    d["rating_count"] = d.get("rating_count") or 0
    return d


# ------------------------------------------------------------- reference --

@app.get("/api/specialties")
def get_specialties():
    return [{"key": k, "name": v[0], "emoji": v[1]} for k, v in SPECIALTIES.items()]


@app.get("/api/cities")
def get_cities():
    return CITIES


# --------------------------------------------------------------- masters --

@app.get("/api/masters")
def api_list_masters(
    specialty: str | None = Query(default=None),
    city: str | None = Query(default=None),
    search: str | None = Query(default=None),
):
    rows = db.list_masters(specialty or None, city or None, search or None)
    return [master_to_dict(r) for r in rows]


@app.get("/api/my-masters/{telegram_id}")
def api_my_masters(telegram_id: int):
    rows = db.list_my_masters(telegram_id)
    return [master_to_dict(r) for r in rows]


@app.post("/api/register")
async def api_register(
    telegram_id: int = Form(...),
    telegram_username: str | None = Form(default=None),
    full_name: str = Form(...),
    age: int = Form(...),
    experience_years: int = Form(...),
    specialty: str = Form(...),
    city: str = Form(...),
    phone: str = Form(...),
    price_info: str | None = Form(default=None),
    bio: str | None = Form(default=None),
    photo: UploadFile = File(...),
):
    full_name = full_name.strip()
    if len(full_name) < 3:
        raise HTTPException(status_code=422, detail="Ism-familiya juda qisqa")
    existing = db.list_my_masters(telegram_id)
    if existing:
        raise HTTPException(
            status_code=422,
            detail="Siz allaqachon usta sifatida ro'yxatdan o'tgansiz. Bitta odam faqat bitta profil ocha oladi. "
                   "Ma'lumotni o'zgartirish uchun avval eski e'loningizni o'chiring, so'ng qaytadan qo'shing.",
        )
    if not (16 <= age <= 90):
        raise HTTPException(status_code=422, detail="Yosh 16 dan 90 gacha bo'lishi kerak")
    if not (0 <= experience_years <= 70):
        raise HTTPException(status_code=422, detail="Tajriba 0 dan 70 yilgacha bo'lishi kerak")
    if specialty not in SPECIALTIES:
        raise HTTPException(status_code=422, detail="Noto'g'ri soha tanlandi")
    if city not in CITIES:
        raise HTTPException(status_code=422, detail="Noto'g'ri hudud tanlandi")
    phone = phone.strip()
    if len(phone) < 9:
        raise HTTPException(status_code=422, detail="Telefon raqami noto'g'ri")
    if bio and len(bio) > 200:
        raise HTTPException(status_code=422, detail="Bio 200 belgidan oshmasligi kerak")

    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=422, detail="Rasm formati JPEG, PNG yoki WEBP bo'lishi kerak")
    contents = await photo.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="Rasm hajmi 5MB dan oshmasligi kerak")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[photo.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = UPLOADS_DIR / filename
    filepath.write_bytes(contents)

    master_id = db.insert_master(
        {
            "telegram_id": telegram_id,
            "telegram_username": telegram_username,
            "full_name": full_name,
            "age": age,
            "experience_years": experience_years,
            "specialty": specialty,
            "city": city,
            "phone": phone,
            "price_info": price_info,
            "bio": bio,
            "photo_path": f"/uploads/{filename}",
        }
    )
    return {"id": master_id, "status": "ok"}


@app.post("/api/masters/{master_id}/delete")
def api_delete_master(master_id: int, telegram_id: int = Form(...)):
    ok = db.soft_delete_master(master_id, telegram_id)
    if not ok:
        raise HTTPException(status_code=403, detail="Bu e'lon sizga tegishli emas")
    return {"status": "ok"}


# ----------------------------------------------------------------- calls --

@app.post("/api/calls")
async def api_create_call(
    master_id: int = Form(...),
    customer_telegram_id: int = Form(...),
    customer_username: str | None = Form(default=None),
    customer_name: str | None = Form(default=None),
    location: str | None = Form(default=None),
):
    master = db.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Usta topilmadi")

    location = (location or "").strip() or None
    call_id = db.insert_call(master_id, customer_telegram_id, customer_username, customer_name, location)

    # Keyingi chaqiruvlar uchun joylashuvni eslab qolamiz (autofill)
    if location:
        db.upsert_customer(customer_telegram_id, customer_username, customer_name, location=location)

    customer_link = f"https://t.me/{customer_username}" if customer_username else None
    customer_display = customer_name or "Noma'lum"
    text_lines = [
        "🔔 <b>Yangi chaqiruv!</b>",
        f"👤 Mijoz: {customer_display}",
    ]
    if customer_link:
        text_lines.append(f"✈️ Telegram: {customer_link}")
    if location:
        text_lines.append(f"📍 Manzil: {location}")
    text_lines.append("\nMijoz siz bilan bog'lanishni kutmoqda. Ishni bajarib bo'lgach, \"Profil\" bo'limida \"Tugatdim\" tugmasini bosing.")
    await notify_telegram(master["telegram_id"], "\n".join(text_lines))

    return {"id": call_id, "status": "ok"}


@app.get("/api/calls/pending/{master_telegram_id}")
def api_pending_calls(master_telegram_id: int):
    rows = db.list_pending_calls(master_telegram_id)
    return [dict(r) for r in rows]


async def send_feedback_prompt(master_id: int, master_name: str, customer_telegram_id: int) -> None:
    """10 daqiqa kutib, mijozga 👍/👎 fikr-mulohaza xabarini yuboradi.
    Tugmalar bosilganda bot.py dagi callback handler javob beradi."""
    await asyncio.sleep(FEEDBACK_DELAY_SECONDS)
    reply_markup = {
        "inline_keyboard": [[
            {"text": "👍", "callback_data": f"rate:up:{master_id}"},
            {"text": "👎", "callback_data": f"rate:down:{master_id}"},
        ]]
    }
    await notify_telegram(
        customer_telegram_id,
        f"✅ <b>{master_name}</b> ish bajarilganini tasdiqladi.\n\nSizga yordam bera oldikmi?",
        reply_markup,
    )


@app.post("/api/calls/{call_id}/finish")
async def api_finish_call(call_id: int, master_telegram_id: int = Form(...)):
    call = db.finish_call(call_id, master_telegram_id)
    if not call:
        raise HTTPException(status_code=403, detail="Bu chaqiruv sizga tegishli emas")

    master = db.get_master(call["master_id"])
    master_name = master["full_name"] if master else "Usta"

    # Darhol emas — 10 daqiqadan keyin fikr-mulohaza so'raladi (fon vazifasi sifatida)
    asyncio.create_task(
        send_feedback_prompt(call["master_id"], master_name, call["customer_telegram_id"])
    )
    return {"status": "ok"}


# --------------------------------------------------------------- ratings --

@app.post("/api/masters/{master_id}/rate")
def api_rate_master(
    master_id: int,
    customer_telegram_id: int = Form(...),
    stars: int = Form(...),
    comment: str | None = Form(default=None),
):
    if not (1 <= stars <= 5):
        raise HTTPException(status_code=422, detail="Baho 1 dan 5 gacha bo'lishi kerak")
    master = db.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Usta topilmadi")
    if db.has_rated(master_id, customer_telegram_id):
        raise HTTPException(status_code=409, detail="Siz bu ustani allaqachon baholagansiz")
    ok = db.insert_rating(master_id, customer_telegram_id, stars, comment)
    if not ok:
        raise HTTPException(status_code=409, detail="Siz bu ustani allaqachon baholagansiz")
    return {"status": "ok"}


@app.get("/api/masters/{master_id}/rated/{customer_telegram_id}")
def api_has_rated(master_id: int, customer_telegram_id: int):
    return {"rated": db.has_rated(master_id, customer_telegram_id)}


# ------------------------------------------------------------- customers --

@app.post("/api/customers/contact")
def api_save_contact(
    telegram_id: int = Form(...),
    telegram_username: str | None = Form(default=None),
    full_name: str | None = Form(default=None),
    phone: str | None = Form(default=None),
):
    db.upsert_customer(telegram_id, telegram_username, full_name, phone)
    return {"status": "ok"}


@app.get("/api/customers/{telegram_id}")
def api_get_customer(telegram_id: int):
    row = db.get_customer(telegram_id)
    if not row:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    return dict(row)


@app.post("/api/customers/location")
def api_save_location(
    telegram_id: int = Form(...),
    location: str = Form(...),
):
    db.upsert_customer(telegram_id, location=location.strip())
    return {"status": "ok"}


# --------------------------------------------------------- ai yordamchi --

AI_SYSTEM_PROMPT = """Sen "Ustak" ilovasidagi AI yordamchisan. O'zbek tilida, iliq va tushunarli tilda javob ber.

Vazifang:
1. Foydalanuvchi biror narsa buzilgani haqida yozsa yoki rasm tashlasa (masalan santexnika, elektr, mebel, texnika muammosi) — avval nima bo'lganini qisqa aniqla.
2. Agar bu foydalanuvchi o'zi (usta chaqirmasdan) tuzata oladigan oddiy muammo bo'lsa — qisqa, aniq, xavfsiz qadamlar bilan qanday tuzatishni tushuntir.
3. Agar muammo jiddiy bo'lsa yoki maxsus asbob/tajriba talab qilsa — buni ayt va qaysi sohadagi ustani chaqirish kerakligini aniq tavsiya qil. Faqat quyidagi sohalardan birini tanla: {specialties}.
4. Javobing oxirida, agar usta chaqirish tavsiya qilinsa, alohida qatorda aniq shu formatda yoz: SPECIALTY: <soha_kaliti> (masalan: SPECIALTY: santexnik). Agar usta kerak bo'lmasa, bu qatorni yozma.
5. Javoblaring qisqa, amaliy va samimiy bo'lsin. Xavfli ishlarda (gaz, yuqori kuchlanish) doim ehtiyot choralarini eslat.
"""


def _extract_specialty_tag(text: str) -> tuple[str, str | None]:
    """Javobdan 'SPECIALTY: key' qatorini ajratib oladi va matndan olib tashlaydi."""
    lines = text.splitlines()
    specialty = None
    kept = []
    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith("SPECIALTY:"):
            key = stripped.split(":", 1)[1].strip().lower()
            if key in SPECIALTIES:
                specialty = key
            continue
        kept.append(line)
    return "\n".join(kept).strip(), specialty


@app.post("/api/ai/chat")
async def api_ai_chat(
    message: str = Form(default=""),
    history: str = Form(default="[]"),
    image: UploadFile | None = File(default=None),
):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI yordamchi hozircha sozlanmagan (GEMINI_API_KEY yo'q). Administratorga murojaat qiling.",
        )

    import json as _json

    try:
        prior_turns = _json.loads(history) if history else []
    except Exception:
        prior_turns = []

    specialties_str = ", ".join(SPECIALTIES.keys())
    contents = []
    for turn in prior_turns[-10:]:
        role = "model" if turn.get("role") == "assistant" else "user"
        text = (turn.get("content") or "").strip()
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})

    parts: list[dict] = []
    if message.strip():
        parts.append({"text": message.strip()})
    if image is not None:
        img_bytes = await image.read()
        if len(img_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=422, detail="Rasm hajmi juda katta")
        import base64
        parts.append({
            "inline_data": {
                "mime_type": image.content_type or "image/jpeg",
                "data": base64.b64encode(img_bytes).decode("ascii"),
            }
        })
    if not parts:
        raise HTTPException(status_code=422, detail="Xabar yoki rasm yuboring")

    contents.append({"role": "user", "parts": parts})

    payload = {
        "system_instruction": {
            "parts": [{"text": AI_SYSTEM_PROMPT.format(specialties=specialties_str)}]
        },
        "contents": contents,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GEMINI_URL, params={"key": GEMINI_API_KEY}, json=payload
            )
        data = resp.json()
        if resp.status_code != 200:
            err_msg = data.get("error", {}).get("message", "AI xatoligi")
            raise HTTPException(status_code=502, detail=f"AI yordamchi xatosi: {err_msg}")
        raw_text = (
            data["candidates"][0]["content"]["parts"][0]["text"]
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="AI yordamchiga ulanib bo'lmadi. Birozdan so'ng qayta urinib ko'ring.")

    clean_text, specialty = _extract_specialty_tag(raw_text)
    result = {"reply": clean_text}
    if specialty:
        name, emoji = SPECIALTIES[specialty]
        result["suggested_specialty"] = specialty
        result["suggested_specialty_label"] = f"{emoji} {name}"
    return result


# ------------------------------------------------------------ static app --

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/")
def serve_index():
    return FileResponse(str(WEBAPP_DIR / "index.html"))


@app.get("/style.css")
def serve_css():
    return FileResponse(str(WEBAPP_DIR / "style.css"), media_type="text/css")


@app.get("/app.js")
def serve_js():
    return FileResponse(str(WEBAPP_DIR / "app.js"), media_type="application/javascript")
