# -*- coding: utf-8 -*-
"""Ustak — aiogram 3.x bot (polling rejimida)."""

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
    WebAppInfo,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ustak-bot")

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")

dp = Dispatcher()


def main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔍 Usta qidirish", web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=search"))],
            [InlineKeyboardButton(text="🧰 Usta bo'lib ro'yxatdan o'tish", web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=register"))],
            [InlineKeyboardButton(text="👤 Profilim", web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=profile"))],
        ]
    )


@dp.message(CommandStart())
async def cmd_start(message: Message) -> None:
    await message.answer(
        f"👋 Assalomu alaykum, {message.from_user.first_name}!\n\n"
        "<b>Ustak</b> orqali sizga kerakli ustani tez topishingiz yoki "
        "o'zingiz usta bo'lsangiz, mijozlar topishingiz mumkin.\n\n"
        "Quyidagi tugmalardan birini tanlang 👇",
        reply_markup=main_keyboard(),
    )


@dp.message(F.text == "/ustalar")
async def cmd_ustalar(message: Message) -> None:
    await cmd_start(message)


@dp.message(F.text == "/help")
async def cmd_help(message: Message) -> None:
    await message.answer(
        "ℹ️ <b>Ustak</b> — mahalliy ustalarni topish uchun bot.\n"
        "/start — ilovani ochish"
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
