# 🛠️ USTAK — Mahalliy ustalarni topish Telegram Mini App

Telegram bot + Web App (Mini App): mijozlar mahalliy ustalarni (santexnik,
elektrik, payvandchi va h.k.) qidiradi va chaqiradi; ustalar ro'yxatdan
o'tib, kelgan chaqiruvlarni ko'radi va baholanadi.

## Texnologiyalar

- **Backend:** Python, FastAPI, SQLite (xom SQL, ORM'siz)
- **Bot:** aiogram 3.x (polling)
- **Frontend:** Vanilla HTML/CSS/JS, Telegram WebApp SDK
- **Dizayn:** "Ish-tegi" (work-tag) uslubi — kremrang qog'oz, po'lat-ko'k,
  xavfsizlik apelsini va latun ranglar; Oswald / Inter / JetBrains Mono
  shriftlari; teg tushishi, tegning tebranishi, "shtamp" bosilishi kabi
  animatsiyalar bilan.

## Lokal ishga tushirish

```bash
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# .env faylida BOT_TOKEN va WEBAPP_URL ni to'ldiring

python run.py
```

Bot va API server bitta jarayonda (`run.py`) birga ishga tushadi.
API `http://localhost:8000` manzilida ko'tariladi, Mini App esa shu
manzilda `/` orqali xizmat qilinadi.

> **Eslatma:** Mini App'ni to'liq sinash uchun uni ochiq URL (masalan,
> ngrok yoki Render) orqali Telegram botiga ulash kerak — Telegram
> `localhost` manzillarini WebApp sifatida ochmaydi.

## Render.com'ga deploy qilish

1. GitHub repo'ni Render'ga ulang.
2. **Web Service** yarating, build buyrug'i: `pip install -r requirements.txt`
3. Start buyrug'i (`Procfile` orqali avtomatik): `python run.py`
4. Environment Variables bo'limida `BOT_TOKEN` va `WEBAPP_URL` (Render
   bergan public URL) ni kiriting.
5. Deploy tugagach, BotFather orqali botning **Menu Button** yoki
   `/setmenubutton` sozlamasida shu WEBAPP_URL'ni belgilang (ixtiyoriy —
   `/start` buyrug'i allaqachon WebApp tugmasini yuboradi).

## Fayl tuzilishi

```
usta-bot/
├── backend/
│   ├── main.py         → FastAPI ilovasi: barcha API endpointlar
│   ├── database.py     → SQLite bilan ishlash (xom SQL, thread-safe)
│   └── constants.py    → Sohalar va hududlar ro'yxati
├── webapp/
│   ├── index.html
│   ├── style.css        → "Ish-tegi" dizayn tizimi + animatsiyalar
│   ├── app.js            → Frontend logika
│   └── uploads/           → Ustalarning rasmlari
├── bot.py                → aiogram bot
├── run.py                → Bot + API serverni birga ishga tushiradi
├── requirements.txt
├── Procfile
└── .env.example
```

## Asosiy foydalanuvchi oqimlari

1. **Usta ro'yxatdan o'tadi** — "Usta bo'lish" tabida forma to'ldiradi,
   rasm yuklaydi (fon yorqinligi brauzerda taxminiy tekshiriladi).
2. **Mijoz qidiradi va chaqiradi** — "Qidirish" tabida soha/hudud bo'yicha
   filtrlaydi, "🔔 Chaqirish" tugmasini bosadi → usta botdan xabar oladi.
3. **Usta chaqiruvni tugatadi** — "Profil" tabida "✅ Tugatdim" bosadi →
   mijozga bot orqali baholash taklifi (deep-link) yuboriladi.
4. **Mijoz baholaydi** — bot xabaridagi tugma orqali Mini App
   `?tab=rate&master_id=X` bilan ochiladi, yulduzcha + izoh bilan
   baholaydi (bitta mijoz — bitta usta uchun faqat bir marta).

## Muhim eslatmalar

- Bot faqat **bitta joyda** polling rejimida ishlashi kerak (aks holda
  `TelegramConflictError`).
- Rasm fon tekshiruvi 100% aniq emas — faqat taxminiy heuristika.
- Bot xabarlari best-effort: `BOT_TOKEN` topilmasa yoki Telegram API
  javob bermasa, asosiy amal (chaqiruv/tugatish) baribir saqlanadi.
