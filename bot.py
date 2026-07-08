# -*- coding: utf-8 -*-
"""Ustak — aiogram 3.x bot (polling rejimida).

Oqim:
1. /start bosilganda — agar mijoz kontaktini hali ulashmagan bo'lsa, kontakt
   ulashish majburiy (boshqa hech narsa qilib bo'lmaydi).
2. Kontakt ulashilgach — bitta tugma: "Ustak'ni ochish" (Mini App).
3. Mini App ichida hammasi: Ustalar / AI Yordamchi / Pro / Profil (usta
   bo'lish ham shu yerda, Profil bo'limida).
"""

import asyncio
import logging
import os

from dotenv import load_dotenv

load_dotenv()

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    KeyboardButton,
    WebAppInfo,
)

from backend import database as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ustak-bot")

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

dp = Dispatcher()


def contact_request_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📞 Kontaktni ulashish", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def webapp_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🧰 Ustak'ni ochish", web_app=WebAppInfo(url=WEBAPP_URL))],
        ]
    )


def is_registered(telegram_id: int) -> bool:
    customer = db.get_customer(telegram_id)
    return bool(customer and customer["phone"])


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    if not is_registered(message.from_user.id):
        await message.answer(
            f"👋 Assalomu alaykum, {message.from_user.first_name}!\n\n"
            "<b>Ustak</b> — mahalliy ustalarni topish va AI yordamchidan maslahat olish uchun ilova.\n\n"
            "Davom etish uchun, iltimos, pastdagi tugma orqali kontaktingizni ulashing 👇",
            reply_markup=contact_request_keyboard(),
        )
        return

    await message.answer(
        f"👋 Xush kelibsiz, {message.from_user.first_name}!\n\n"
        "Quyidagi tugma orqali <b>Ustak</b> ilovasini oching 👇",
        reply_markup=webapp_keyboard(),
    )


@dp.message(F.contact)
async def on_contact(message: Message) -> None:
    contact = message.contact
    # Faqat o'zining kontaktini qabul qilamiz
    if contact.user_id and contact.user_id != message.from_user.id:
        await message.answer("Iltimos, faqat o'zingizning kontaktingizni ulashing.")
        return

    full_name = " ".join(filter(None, [contact.first_name, contact.last_name])) or message.from_user.first_name

    db.upsert_customer(
        telegram_id=message.from_user.id,
        telegram_username=message.from_user.username,
        full_name=full_name,
        phone=contact.phone_number,
    )

    await message.answer(
        "✅ Rahmat! Endi <b>Ustak</b> ilovasidan foydalanishingiz mumkin.",
        reply_markup=ReplyKeyboardRemove(),
    )
    await message.answer(
        "Quyidagi tugma orqali ilovani oching 👇",
        reply_markup=webapp_keyboard(),
    )


@dp.message(F.text == "/help")
async def cmd_help(message: Message) -> None:
    await message.answer(
        "ℹ️ <b>Ustak</b> — mahalliy ustalarni topish va AI yordamchidan maslahat olish uchun bot.\n"
        "/start — ilovani ochish"
    )


@dp.message()
async def on_any_message(message: Message) -> None:
    """Kontakt ulashilmaguncha bot bilan boshqa hech narsa qilib bo'lmaydi."""
    if not is_registered(message.from_user.id):
        await message.answer(
            "Davom etishdan oldin, iltimos, kontaktingizni ulashing 👇",
            reply_markup=contact_request_keyboard(),
        )
        return
    await message.answer(
        "Ilovani ochish uchun tugmani bosing 👇",
        reply_markup=webapp_keyboard(),
    )


async def run_bot() -> None:
    if not BOT_TOKEN:
        logger.warning("BOT_TOKEN topilmadi — bot ishga tushmaydi.")
        return
    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(run_bot())
