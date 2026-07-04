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

## ✨ Qo'shilgan yangi funksiyalar

- **Dark/Light rejim** — header'dagi 🌙/☀️ tugmasi orqali, tanlov brauzerda saqlanadi
- **Profil bo'limi** (pastki menyuda 👤) — o'zingiz bergan va sizga kelgan buyurtmalar, faol e'lonlaringiz statistikasi
- **Buyurtma tizimi** — mijoz "🧾 Buyurtma" tugmasini bosib, ismi, telefon raqami va joylashuvini (GPS yoki qo'lda manzil) yuboradi; usta Telegram orqali darhol xabar oladi (matn + joylashuv)
- **Sodiqlik aksiyasi** — mijoz 10-marta buyurtma bersa, ekranda tabriklovchi bonus xabari chiqadi
- **Telegram orqali bog'lanish** — agar usta Telegram username kiritgan bo'lsa, kartochkada ✈️ tugmasi chiqadi
- **Yangi logotip** — headerda maxsus chizilgan belgi (SVG)

## 🚀 Keyingi qadamlar (rivojlantirish g'oyalari)

- Reyting/sharh tizimi (mijozlar ustani baholaydi)
- Admin panel orqali e'lonlarni tasdiqlash/rad etish
- Bir nechta rasm yuklash imkoniyati
- Buyurtmani "bajarildi/bekor qilindi" statusiga o'tkazish imkoniyati

---

## 🔄 O'zgarishlarni GitHub va Render'ga qayta yuklash

Kodni har safar o'zgartirganda (yoki Claude orqali yangi versiyasini olganda), uni ishlatish uchun 2 qadam kerak: **GitHub'ga yuklash**, keyin **Render avtomatik qayta deploy qiladi**.

### Agar Git o'rnatilgan bo'lsa (tavsiya etiladi)

Loyiha papkasida PowerShell/terminalda:
```bash
git add .
git commit -m "Yangilanish"
git push
```
Shu uchta buyruq yetarli — Render buni avtomatik ko'rib, o'zi qayta deploy qiladi (GitHub bilan bog'langan bo'lsa, "Auto-Deploy" yoqilgan holatda).

### Agar Git yo'q bo'lsa — brauzer orqali

1. `https://github.com/<username>/<repo>` sahifangizga o'ting
2. **"Add file" → "Upload files"** tugmasini bosing
3. Yangilangan fayl/papkalarni (masalan yangi `webapp` va `backend` papkalarini) sudrab tashlang — bir xil nomdagi fayllar avtomatik almashtiriladi (overwrite)
4. **"Commit changes"** tugmasini bosing
5. Render dashboard'ga o'ting — "Events" bo'limida yangi deploy avtomatik boshlanganini ko'rasiz (agar boshlanmasa, "Manual Deploy → Deploy latest commit" ni bosing)

### Deploy holatini tekshirish

Render dashboard → **"Logs"** bo'limida `Your service is live 🎉` yozuvi chiqsa — muvaffaqiyatli yangilangan.
