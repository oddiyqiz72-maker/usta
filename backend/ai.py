# backend/ai.py
"""
UstaKerak AI Yordamchi.
Google Gemini API orqali ishlaydigan yordamchi:
  - Bot va ilova haqida savollarga javob beradi
  - Foydalanuvchi tasvirlagan muammo asosida qaysi usta kerakligini tavsiya qiladi
  - Yuklangan rasm asosida (masalan, buzilgan jihoz/naycha rasmi) muammoni aniqlashga
    yordam beradi va qaysi soha ustasi kerakligini aytadi
Muhim: GEMINI_API_KEY muhit o'zgaruvchisi sozlanishi shart (https://aistudio.google.com/apikey
orqali bepul olinadi). Bo'lmasa, yordamchi tushunarli xato xabari bilan javob beradi
(bot yiqilib qolmaydi).
"""

import os
import httpx
from backend.constants import SPECIALTIES

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

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


def _to_gemini_role(role: str) -> str:
    # Gemini "user" / "model" rollarini kutadi (bizda "user" / "assistant")
    return "model" if role == "assistant" else "user"


async def ask_ai(messages: list, image_base64: str = None, image_media_type: str = None) -> str:
    """
    messages: [{"role": "user"|"assistant", "content": "..."}]  (oxirgi xabar foydalanuvchidan)
    image_base64: ixtiyoriy, oxirgi foydalanuvchi xabariga rasm biriktirilsa
    """
    if not GEMINI_API_KEY:
        return ("AI Yordamchi hozircha sozlanmagan. Administrator GEMINI_API_KEY "
                "muhit o'zgaruvchisini qo'shishi kerak (https://aistudio.google.com/apikey).")

    contents = []
    for i, m in enumerate(messages):
        parts = [{"text": m["content"]}]
        if i == len(messages) - 1 and m["role"] == "user" and image_base64:
            parts.insert(0, {
                "inline_data": {
                    "mime_type": image_media_type or "image/jpeg",
                    "data": image_base64,
                }
            })
        contents.append({"role": _to_gemini_role(m["role"]), "parts": parts})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_API_KEY},
                headers={"content-type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": contents,
                    "generationConfig": {"maxOutputTokens": 700},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                feedback = data.get("promptFeedback", {})
                if feedback.get("blockReason"):
                    return "Kechirasiz, bu so'rovga javob bera olmayman. Boshqacha savol bering."
                return "Kechirasiz, javob shakllantira olmadim. Qaytadan urinib ko'ring."
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "\n".join(p.get("text", "") for p in parts).strip()
            return text or "Kechirasiz, javob shakllantira olmadim. Qaytadan urinib ko'ring."
    except httpx.HTTPStatusError as e:
        return f"AI xizmatida xatolik yuz berdi ({e.response.status_code}). Birozdan so'ng qayta urinib ko'ring."
    except Exception:
        return "AI xizmatiga ulanishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
