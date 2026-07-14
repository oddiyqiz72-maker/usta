# bot.py
"""
UstaKerak Telegram bot (aiogram 3.x, polling rejimida).

Oqim:
  /start -> agar foydalanuvchi hali kontakt ulashmagan bo'lsa, majburiy ravishda
            "📱 Raqamni ulashish" tugmasi ko'rsatiladi (boshqa hech narsa qabul qilinmaydi).
  Kontakt ulashilgach -> foydalanuvchi bazaga yoziladi va ikkita tugma chiqadi:
            🚀 Ilovani ochish (WebApp)   💬 Yordam / Qo'llab-quvvatlash
"""

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import (
    Message, ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo,
)

from backend import database as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ustak-bot")

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")
SUPPORT_USERNAME = os.environ.get("SUPPORT_USERNAME", "ustak_support")

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML)) if BOT_TOKEN else None
dp = Dispatcher()

CONTACT_KB = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="📱 Raqamni ulashish", request_contact=True)]],
    resize_keyboard=True,
    one_time_keyboard=True,
)


def main_menu_kb() -> InlineKeyboardMarkup:
    rows = []
    if WEBAPP_URL:
        rows.append([InlineKeyboardButton(text="🚀 Ilovani ochish", web_app=WebAppInfo(url=WEBAPP_URL))])
    rows.append([InlineKeyboardButton(text="💬 Yordam / Qo'llab-quvvatlash", url=f"https://t.me/{SUPPORT_USERNAME}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


WELCOME_TEXT = (
    "👋 <b>UstaKerak</b>ka xush kelibsiz!\n\n"
    "🛠 Bu yerda siz santexnik, elektrik, payvandchi va boshqa mahalliy ustalarni "
    "tez topib, ular bilan to'g'ridan-to'g'ri bog'lanishingiz mumkin.\n\n"
    "Davom etish uchun avval telefon raqamingizni ulashing — bu ustalar siz bilan "
    "bog'lana olishi uchun kerak."
)

READY_TEXT = (
    "✅ Rahmat! Endi <b>UstaKerak</b> ilovasidan to'liq foydalanishingiz mumkin.\n\n"
    "🛠 <b>Ustalar</b> — soha va hudud bo'yicha usta qidiring\n"
    "🤖 <b>AI Yordamchi</b> — muammoingizni tasvirlab bering yoki rasm yuboring, "
    "qaysi usta kerakligini aytib beradi\n"
    "👤 <b>Profil</b> — sozlamalar, usta bo'lish va qo'llab-quvvatlash"
)


@dp.message(Command("start"))
async def cmd_start(message: Message):
    user = db.get_user(message.from_user.id)
    if user and user.get("phone"):
        await message.answer(READY_TEXT, reply_markup=main_menu_kb())
        return
    await message.answer(WELCOME_TEXT, reply_markup=CONTACT_KB)


@dp.message(F.contact)
async def on_contact(message: Message):
    contact = message.contact
    if contact.user_id and contact.user_id != message.from_user.id:
        await message.answer(
            "⚠️ Iltimos, o'zingizning shaxsiy raqamingizni ulashing.",
            reply_markup=CONTACT_KB,
        )
        return

    db.upsert_user_contact(
        telegram_id=message.from_user.id,
        username=message.from_user.username or "",
        full_name=message.from_user.full_name or "",
        phone=contact.phone_number,
    )
    await message.answer(READY_TEXT, reply_markup=ReplyKeyboardRemove())
    await message.answer("👇 Boshlash uchun ilovani oching:", reply_markup=main_menu_kb())


@dp.message()
async def fallback(message: Message):
    user = db.get_user(message.from_user.id)
    if not user or not user.get("phone"):
        await message.answer(
            "Davom etish uchun avval telefon raqamingizni ulashing 👇",
            reply_markup=CONTACT_KB,
        )
        return
    await message.answer(
        "Ilovani ochish uchun quyidagi tugmadan foydalaning 👇",
        reply_markup=main_menu_kb(),
    )


async def start_bot():
    if not bot:
        logger.warning("BOT_TOKEN topilmadi — bot ishga tushmaydi (faqat API server ishlaydi).")
        return
    db.init_db()
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(start_bot())
