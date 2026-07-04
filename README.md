# 🧰 Ustalar Bot — Telegram bot + Web App

Bu loyiha ikki qismdan iborat:
1. **Telegram bot** — foydalanuvchiga "Usta qidirish" va "Usta bo'lish" tugmalarini ko'rsatadi
2. **Web App (Mini App)** — tugma bosilganda ochiladigan sahifa: qidiruv va ro'yxatdan o'tish formasi

Ma'lumotlar (ustalar ro'yxati, rasmlar) serverdagi SQLite bazasida va papkada saqlanadi — bot va server ishlab turgan ekan, ma'lumotlar yo'qolmaydi.

---

## 📁 Loyiha tuzilishi

```
usta-bot/
├── backend/
│   ├── main.py         → API va Web App'ni xizmat qiluvchi FastAPI server
│   ├── database.py     → SQLite bilan ishlash
│   └── constants.py    → Sohalar va hududlar ro'yxati (shu yerdan o'zgartirasiz)
├── webapp/
│   ├── index.html       → Mini App sahifasi
│   ├── style.css
│   ├── app.js
│   └── uploads/          → Ustalarning rasmlari shu yerga saqlanadi
├── bot.py                → Telegram bot (aiogram)
├── run.py                → Bot + serverni BIRGA ishga tushiradi (deploy uchun shu ishlatiladi)
├── requirements.txt
├── Procfile              → Render/Railway uchun ishga tushirish buyrug'i
└── .env.example          → Muhit o'zgaruvchilari namunasi
```

---

## 1-QADAM: Bot yaratish

1. Telegramda **@BotFather** ga yozing
2. `/newbot` buyrug'ini yuboring, botga ism va username bering
3. Sizga beriladigan **tokenni** saqlab qo'ying (masalan: `123456789:AAExample...`)

---

## 2-QADAM: Serverga joylashtirish (deploy)

Web App **HTTPS** manzilda ishlashi shart (Telegram talabi). Eng oson yo'l — bepul **Render.com** yoki **Railway.app** dan foydalanish.

### Render.com orqali (tavsiya etiladi, bepul boshlash mumkin)

1. Ushbu loyihani GitHub'ga yuklang (yangi repository yarating va kodni push qiling)
2. [render.com](https://render.com) da ro'yxatdan o'ting → **New + → Web Service**
3. GitHub repository'ingizni tanlang
4. Sozlamalar:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python run.py`
5. **Environment Variables** bo'limida qo'shing:
   - `BOT_TOKEN` = @BotFather bergan tokeningiz
   - `WEBAPP_URL` = Render sizga beradigan manzil (masalan `https://usta-bot.onrender.com`) — **birinchi marta deploy qilib, manzilni ko'rgandan keyin shuni qo'shib, qayta deploy qiling**
6. Deploy tugagach, Telegram'da botingizga `/start` yozing — tugmalar ishlashi kerak

> ⚠️ **Muhim:** Render'ning bepul tarifida server 15 daqiqa foydalanilmasa "uxlab qoladi" va keyingi so'rovda 30-60 soniya sekinroq ochiladi. Doimiy tez ishlashi uchun pullik tarif ($7/oy dan) yoki Railway/VPS tavsiya etiladi.

### Railway.app orqali (muqobil variant)

Xuddi shunday: GitHub'dan ulaysiz, `BOT_TOKEN` va `WEBAPP_URL` qo'shasiz, Railway avtomatik `Procfile`ni o'qib ishga tushiradi.

### Oddiy VPS orqali (eng barqaror, lekin texnik bilim talab qiladi)

Agar o'z serveringiz (VPS) bo'lsa:
```bash
git clone <repo-manzilingiz>
cd usta-bot
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # va .env faylini to'ldiring
# Nginx + SSL (Let's Encrypt) orqali domeningizni ulang, keyin:
python run.py
```
Doimiy ishlashi uchun `systemd` yoki `pm2`/`supervisor` orqali process manager sifatida sozlang, aks holda server qayta ishga tushganda bot to'xtab qoladi.

---

## 3-QADAM: Mahalliy kompyuterda sinab ko'rish (ixtiyoriy)

Web App HTTPS talab qilgani uchun to'liq botni faqat serverga joylagandan keyin sinab ko'rasiz. Lekin API va sahifani mahalliy tekshirish uchun:

```bash
pip install -r requirements.txt
cp .env.example .env   # BOT_TOKEN kiriting
uvicorn backend.main:app --reload --port 8000
```
Brauzerda `http://127.0.0.1:8000` ni oching — qidiruv va forma ko'rinadi (lekin Telegram funksiyalari, masalan foydalanuvchi ID'si, ishlamaydi).

---

## ⚙️ Sozlash — sohalar va hududlarni o'zgartirish

`backend/constants.py` faylini oching:
- `SPECIALTIES` — usta sohalari ro'yxati (kod, nom, emoji)
- `CITIES` — hududlar ro'yxati

Bu yerga yangi soha yoki shahar qo'shsangiz, avtomatik ravishda qidiruv filtrlarida va formada paydo bo'ladi.

---

## 🔒 Muhim eslatmalar

- **Rasm fon tekshiruvi** brauzer tomonida (JavaScript) taxminiy tarzda ishlaydi — 100% aniq emas, lekin ochiq fonli bo'lmagan rasmlarni ko'pchilik holatda ushlab qoladi va foydalanuvchini ogohlantiradi.
- **Moderatsiya:** hozirgi versiyada har bir usta o'zi ro'yxatdan o'tgach, e'lon **darhol** qidiruvda ko'rinadi (tasdiqlash kerak emas). Agar keyinchalik admin tasdiqlovi qo'shmoqchi bo'lsangiz, `database.py` dagi `is_active` maydonidan foydalanib, yangi ro'yxatdan o'tganlarni `is_active=0` bilan saqlab, admin panelda tasdiqlash funksiyasini qo'shish mumkin — shunga alohida murojaat qiling.
- **Zaxira nusxa:** `backend/ustalar.db` va `webapp/uploads/` papkasi — bularni muntazam zaxiralab turing (masalan haftada bir marta serverdan yuklab oling), chunki ba'zi bepul hosting xizmatlari qayta ishga tushganda vaqtinchalik fayllarni tozalab yuborishi mumkin (Render'ning bepul tarifida disk doimiy emas — buni albatta tekshiring yoki "Persistent Disk" qo'shing).

---

## 🚀 Keyingi qadamlar (rivojlantirish g'oyalari)

- Reyting/sharh tizimi (mijozlar ustani baholaydi)
- Admin panel orqali e'lonlarni tasdiqlash/rad etish
- Bir nechta rasm yuklash imkoniyati
- Push-xabar: yangi mos usta paydo bo'lganda mijozga bot orqali xabar berish
