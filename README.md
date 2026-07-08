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
# .env faylida BOT_TOKEN, WEBAPP_URL va (ixtiyoriy) GEMINI_API_KEY ni to'ldiring
# Gemini API kaliti: https://aistudio.google.com/apikey (bepul reja bor)

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
   bergan public URL) ni kiriting. AI yordamchi ishlashi uchun
   `GEMINI_API_KEY` ni ham qo'shing (ixtiyoriy — bo'lmasa AI tabi xato
   xabarini ko'rsatadi, boshqa hamma narsa ishlayveradi).
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

1. **Botni ishga tushirish** — `/start` bosilganda kontaktni ulashish
   majburiy (kontakt ulashilmaguncha boshqa hech narsa qilib bo'lmaydi).
   Kontakt ulashilgach, bitta tugma chiqadi: **"🧰 Ustak'ni ochish"**.
2. **Mini App 4 ta bo'limdan iborat** (pastki tab):
   - **Ustalar** — soha/hudud bo'yicha qidirish, "🔔 Chaqirish" bosilsa
     manzil so'raladi (avvalgi manzil eslab qolinadi va avtomatik
     to'ldiriladi), so'ng usta botdan xabar oladi.
   - **AI Yordamchi** — matn yoki rasm yuborilsa, Gemini API orqali
     tahlil qiladi: oddiy muammoni o'zi tuzatishga yordam beradi yoki
     tegishli soha ustasini tavsiya qilib, bitta tugma bilan o'sha
     sohadagi ustalar ro'yxatiga o'tkazadi.
   - **Pro** — hozircha "Tez orada" sahifasi.
   - **Profil** — o'z ma'lumotlari (ism, telefon), kutilayotgan
     chaqiruvlar, o'z e'lonlari va **"🧰 Usta bo'lish"** tugmasi (bosilsa
     ro'yxatdan o'tish formasi modal oynada ochiladi).
3. **Usta chaqiruvni tugatadi** — "Profil" bo'limida "✅ Tugatdim" bosadi →
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
