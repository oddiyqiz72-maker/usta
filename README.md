# USTAK — Mahalliy ustalarni topish Telegram Mini App (v2)

To'liq qayta yozilgan versiya: yangi dizayn (to'q ko'mir-ko'k + jez/zumrad palitra),
4 bo'limli pastki navigatsiya (**Ustalar · AI Yordamchi · Pro obuna · Profil**),
majburiy kontakt ulashish, va AI yordamchi (matn + rasm orqali).

## Nima yangilandi

- **Yangi dizayn** — eskisidan (apelsin + po'lat-ko'k) butunlay farqli: to'q fon,
  jez (brass) va zumrad rang, Sora / Manrope / IBM Plex Mono shriftlar.
- **4 ta bo'lim**: Ustalar (qidiruv), AI Yordamchi (chat, rasm tahlili), Pro obuna
  (ustalar uchun qidiruvda yuqorida chiqish), Profil (sozlamalar).
- **Profil**: tungi rejim va animatsiya on/off tugmalari, "Usta bo'lish" oqimi,
  "Mening e'lonlarim", "Kutilayotgan chaqiruvlar", "Saqlangan ustalar",
  "Yordam / Qo'llab-quvvatlash" havolasi.
- **Bot**: `/start` bosilganda kontaktni ulashish **majburiy**, so'ng
  "🚀 Ilovani ochish" va "💬 Yordam" tugmalari chiqadi.
- **Chaqiruv oqimi**: mijoz "Chaqirish"ni bosganda ustaga mijozning ismi,
  **telefon raqami**, Telegram username va yozgan izohi bilan xabar boradi —
  usta mijozga to'g'ridan-to'g'ri qo'ng'iroq qila oladi.
- **Adashib ketmaslik uchun**: har bir ustaga noyob `US-XXXX` ID kodi beriladi
  va u qidiruv kartochkasida doim ko'rinadi.
- **Saqlanganlar (favorites)**, **statistika**, **PRO nishон** kabi qo'shimcha
  qulayliklar.

## Fayl tuzilishi

```
usta-bot/
├── backend/
│   ├── main.py       → FastAPI: barcha API + webapp statik fayllar
│   ├── database.py   → SQLite (xom SQL)
│   ├── constants.py  → sohalar, hududlar, PRO rejalar
│   └── ai.py         → AI Yordamchi (Anthropic API proksi)
├── webapp/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── uploads/
├── bot.py             → aiogram 3 bot
├── run.py             → bot + API serverni birga ishga tushiradi
├── requirements.txt
├── Procfile
└── .env.example
```

## Render.com'ga joylashtirish

1. Repo'ni GitHub'ga yuklang.
2. Render'da **New → Web Service** yarating, shu repo'ni tanlang.
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python run.py`
5. **Environment** bo'limida quyidagilarni qo'shing (`.env.example`ga qarang):
   - `BOT_TOKEN`
   - `WEBAPP_URL` — Render bergan manzil (masalan `https://ustak.onrender.com`)
   - `ADMIN_IDS`
   - `SUPPORT_USERNAME`
   - `ANTHROPIC_API_KEY` — AI Yordamchi ishlashi uchun
6. Deploy tugagach, @BotFather'da botingizga Menu Button sifatida
   `WEBAPP_URL`ni ulang (`/setmenubutton`).

## Muhim eslatmalar

- Bot faqat **bitta joyda** ishlashi kerak (polling), aks holda
  `TelegramConflictError` chiqadi.
- `ANTHROPIC_API_KEY` bo'lmasa, AI Yordamchi tushunarli xato xabarini qaytaradi,
  lekin bot/ilova ishlashda davom etadi.
- SQLite fayli (`backend/ustalar.db`) Render'ning **disk qayta ishga tushganda
  tozalanadigan** fayl tizimida saqlanadi — doimiy ma'lumot uchun Render Disk
  (persistent disk) qo'shish yoki keyinchalik PostgreSQL'ga o'tish tavsiya etiladi.
- PRO obuna hozircha **so'rov-asosida**: mijoz reja tanlaydi → admin(lar)ga xabar
  boradi → admin `/pro_confirm <USTA_KODI> <kunlar>` buyrug'i bilan tasdiqlaydi.
  Real to'lov integratsiyasi (Payme/Click) keyingi bosqichda qo'shilishi mumkin.

## Keyingi rivojlantirish g'oyalari

- Admin moderatsiya paneli (yangi ustalarni tasdiqlash)
- Bir nechta rasm yuklash
- Payme/Click orqali PRO to'lovini avtomatlashtirish
- Push-eslatmalar (masalan, uzoq javobsiz chaqiruvlar uchun)
- PostgreSQL'ga o'tish (Render persistent storage muammosini hal qilish uchun)
