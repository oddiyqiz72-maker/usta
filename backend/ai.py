# backend/ai.py
"""
UstaKerak AI Yordamchi.
Anthropic API (Claude) orqali ishlaydigan yordamchi:
  - Bot va ilova haqida savollarga javob beradi
  - Foydalanuvchi tasvirlagan muammo asosida qaysi usta kerakligini tavsiya qiladi
  - Yuklangan rasm asosida (masalan, buzilgan jihoz/naycha rasmi) muammoni aniqlashga
    yordam beradi va qaysi soha ustasi kerakligini aytadi
Muhim: ANTHROPIC_API_KEY muhit o'zgaruvchisi sozlanishi shart. Bo'lmasa, yordamchi
tushunarli xato xabari bilan javob beradi (bot yiqilib qolmaydi).
"""

import os
import httpx
from backend.constants import SPECIALTIES

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = f"""Sen "UstaKerak" Telegram Mini App ilovasining AI Yordamchisisan.
UstaKerak — O'zbekistonda mahalliy ustalarni (santexnik, elektrik, payvandchi va h.k.) topish
va ular bilan bog'lanish uchun xizmat. Sening vazifalaring:

1. Ilova qanday ishlashini tushuntirish: foydalanuvchi "Ustalar" bo'limida soha va hudud
   bo'yicha usta qidiradi, kartochkada "Chaqirish" tugmasini bosadi, shunda ustaga
   Telegram orqali xabar boradi va usta mijoz bilan bog'lanadi.
2. Foydalanuvchi muammosini tasvirlab bersa (matn yoki rasm orqali), qaysi soha
   ustasi kerakligini aniq tavsiya qilish. Mavjud sohalar ro'yxati:
   {", ".join(s["name"] for s in SPECIALTIES)}.
3. Agar rasm yuborilsa (masalan, buzilgan kran, elektr provodi, naycha, devor va h.k.),
   rasmni tahlil qilib, ehtimoliy muammoni tushuntirish va qaysi usta chaqirish
   kerakligini aytish. Xavfli holatlarda (masalan, gaz hidi, ochiq elektr sim)
   darhol ehtiyot choralari haqida ogohlantirish va professional ustaga murojaat
   qilishni maslahat berish.
4. Ustalik bo'yicha oddiy maslahatlar berish mumkin, lekin murakkab yoki xavfli
   ishlarni (gaz, yuqori kuchlanish) doim mutaxassisga topshirishni tavsiya qilish.
5. Javoblaring o'zbek tilida, qisqa, do'stona va aniq bo'lsin. Ortiqcha uzun
   matn yozma, mobil ekranda o'qiladi.
"""


async def ask_ai(messages: list, image_base64: str = None, image_media_type: str = None) -> str:
    """
    messages: [{"role": "user"|"assistant", "content": "..."}]  (oxirgi xabar foydalanuvchidan)
    image_base64: ixtiyoriy, oxirgi foydalanuvchi xabariga rasm biriktirilsa
    """
    if not ANTHROPIC_API_KEY:
        return ("AI Yordamchi hozircha sozlanmagan. Administrator ANTHROPIC_API_KEY "
                "muhit o'zgaruvchisini qo'shishi kerak.")

    api_messages = []
    for i, m in enumerate(messages):
        if i == len(messages) - 1 and m["role"] == "user" and image_base64:
            api_messages.append({
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": image_media_type or "image/jpeg", "data": image_base64}},
                    {"type": "text", "text": m["content"]},
                ]
            })
        else:
            api_messages.append({"role": m["role"], "content": m["content"]})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 700,
                    "system": SYSTEM_PROMPT,
                    "messages": api_messages,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            parts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
            return "\n".join(parts).strip() or "Kechirasiz, javob shakllantira olmadim. Qaytadan urinib ko'ring."
    except httpx.HTTPStatusError as e:
        return f"AI xizmatida xatolik yuz berdi ({e.response.status_code}). Birozdan so'ng qayta urinib ko'ring."
    except Exception:
        return "AI xizmatiga ulanishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
