# Global Donat Bot

Telegram bot + Mini App (WebApp): foydalanuvchi bitta ilova ichida O'yinlar
(PUBG, Mobile Legends, Standoff 2) va App (Telegram Premium, Stars, NFT —
sotib olish yoki ijaraga olish) bo'limlaridan xarid qiladi, balansni karta
orqali to'ldiradi. To'lovlar admin guruhda tugma bilan yoki **SMS orqali
avtomatik** tasdiqlanadi.

## Qanday ishlaydi

1. Foydalanuvchi botga /start yozadi -> "🚀 Ochish" tugmasi (Mini App) chiqadi.
2. Bosh sahifada ikkita bo'lim: **O'yinlar** (PUBG / ML / Standoff 2) va
   **App** (Premium / Stars / NFT). Hammasi bitta ilova ichida, tashqariga
   chiqmaydi.
3. NFT bo'limida har bir buyum uchun ikkita tugma: "🛒 Sotib olish" va
   "⏳ Ijaraga olish" (kunlar sonini kiritib narx avtomatik hisoblanadi).
4. Mahsulot tanlab, ID (yoki Telegram username) kiritilgach:
   - Balans yetarli bo'lsa -> pul yechiladi, buyurtma **admin guruhga**
     ketadi (✅ Bajarildi / ❌ Bekor qilish tugmalari bilan).
   - Yetmasa -> "Mablag' yetarli emas" + balans to'ldirish oynasi.
5. Balansni to'ldirish: summa -> karta raqami -> pul o'tkazish -> tasdiqlash
   ikki xil yo'l bilan bo'ladi:
   - **Qo'lda**: admin guruhda "✅ Tasdiqlash" tugmasini bosadi.
   - **Avtomatik (SMS orqali)**: quyidagi bo'limga qarang.

## Rasmlar (logotiplar)

Har bir o'yin/mahsulot uchun rasm `public/images/` papkasida, `products.js`
faylida ko'rsatilgan fayl nomlari bilan. Hozircha vaqtinchalik (harf +
gradient) ikonalar qo'yilgan — **haqiqiy logotiplarni** shu joyga xuddi shu
fayl nomlari bilan almashtiring (PNG yoki SVG, kvadrat, ~256x256):

```
public/images/
  pubg.svg       -> PUBG Mobile logotipi
  uc.svg         -> UC (PUBG valyutasi) rasmi
  mlbb.svg       -> Mobile Legends logotipi
  diamond.svg    -> Diamond (ML valyutasi) rasmi
  standoff.svg   -> Standoff 2 logotipi
  gold.svg       -> Standoff Gold rasmi
  premium.svg    -> Telegram Premium belgisi
  stars.svg      -> Telegram Stars belgisi
  nft.svg        -> NFT umumiy rasmi (har bir NFT uchun alohida ham qo'yish mumkin — products.js dagi "icon" maydonini o'zgartiring)
```

> Eslatma: PUBG, Mobile Legends, Telegram va h.k. rasmiy logotiplari mualliflik
> huquqi bilan himoyalangan — men ularni avtomatik yuklab yoki nusxalab
> bera olmayman. Siz o'zingiz rasmiy saytlardan yoki dizaynerdan olib shu
> papkaga qo'yasiz, kod avtomatik ularni ishlatadi.

## SMS orqali avtomatik to'lov aniqlash

Karta egasining telefoniga bepul "SMS forwarder" ilovasi (Play Store'da
ko'p, masalan "SMS Forwarder" yoki Tasker) o'rnatiladi va bank SMS kelganda
uni serveringizga yuboradi:

**Endpoint:** `POST https://domeningiz.uz/api/sms/webhook?secret=SMS_SECRET`
**Body (JSON):** `{ "text": "<SMS matni to'liq>", "sender": "<yuboruvchi>" }`

Bot SMS matnidan summani ("25 000 so'm", "25000 UZS" kabi) avtomatik topadi,
xuddi shu summadagi kutilayotgan to'lov bilan solishtiradi va mos kelsa
darhol foydalanuvchi balansini to'ldiradi — admin qo'l tegizmasa ham bo'ladi.
Agar mos to'lov topilmasa, SMS matni tekshirish uchun admin guruhga yuboriladi.

`.env` faylida `SMS_SECRET` ni albatta o'zgartiring (tasodifiy odam
webhookga so'rov yubormasligi uchun).

> Bank SMS matni formati bank/ operatorga qarab farq qilishi mumkin — agar
> summa to'g'ri aniqlanmasa, `server.js` dagi regex qatorini (SMS matningizga
> moslab) o'zgartirib bering, aytsangiz shuni ham sozlab beraman.

## O'rnatish

```bash
npm install
cp .env.example .env
```

`.env` faylini to'ldiring:

- `BOT_TOKEN` — @BotFather'dan olingan token
- `ADMIN_GROUP_ID` — buyurtmalar/to'lovlar tushadigan guruh ID (botni guruhga
  **admin** qilib qo'shing, aks holda xabar/tugma yubora olmaydi)
- `CARD_NUMBER`, `CARD_HOLDER` — foydalanuvchiga ko'rsatiladigan karta
- `PUBLIC_URL` — **https** manzil (Telegram Mini App faqat https bilan
  ishlaydi). VPS'ga joylab, domen + SSL (masalan Caddy yoki Nginx+Certbot
  orqali, bepul) ulang. Test uchun `ngrok http 3000` bilan vaqtinchalik https
  link olsa ham bo'ladi.

Guruh ID'sini topish: botni guruhga qo'shing, guruhda biror xabar yozing,
so'ng brauzerda oching:
`https://api.telegram.org/bot<TOKEN>/getUpdates` — javobda `"chat":{"id":...}`
qatoridagi (manfiy) raqam shu ID.

## Ishga tushirish

```bash
npm start
```

Har doim ishlab turishi uchun VPS'da `pm2` bilan tavsiya etiladi:

```bash
npm install -g pm2
pm2 start server.js --name global-donat
pm2 save
```

## Fayllar tuzilishi

```
server.js        -> Express API + Telegraf bot (asosiy backend)
db.js            -> SQLite (users, topups, orders)
products.js      -> O'yinlar va narxlar ro'yxati (shu yerdan tahrirlanadi)
public/          -> Mini App (dizayn) - index.html, style.css, app.js
.env             -> maxfiy sozlamalar (token, karta, guruh ID)
```

## Narxlarni / o'yinlarni / NFT'larni o'zgartirish

`products.js` faylidagi `games` (O'yinlar) va `apps` (App: Premium/Stars/NFT)
massivlarini tahrirlang. NFT uchun `buyPrice` (sotib olish narxi) va
`rentPricePerDay` (1 kunlik ijara narxi) alohida beriladi. Yangi o'yin yoki
mahsulot qo'shish uchun shunchaki yangi obyekt qo'shsangiz bo'ldi, frontend
avtomatik o'qib oladi — kod o'zgartirish shart emas.

## Keyingi qadam (ixtiyoriy)

- Click/Payme kabi rasmiy to'lov tizimlari ulash (komissiya evaziga, lekin
  100% avtomatik va professional ko'rinadi, SMS'ga bog'liq bo'lmaydi).
- NFT ijarasi tugagach avtomatik eslatma/qaytarib olish eslatmasi qo'shish.
- Real vaqtda buyurtma holatini WebApp ichida push-yangilanish (hozircha
  balans va tarix qayta ochilganda yangilanadi).
