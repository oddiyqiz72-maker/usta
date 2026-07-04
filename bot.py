"""
Ustalar qidirish boti.
Ishga tushirish: python bot.py
Kerakli muhit o'zgaruvchilari (.env faylida yoki serverda o'rnatiladi):
  BOT_TOKEN    - @BotFather dan olingan token
  WEBAPP_URL   - Web App joylashgan HTTPS manzil (masalan https://ustalar.example.com)
"""
import asyncio
import logging
import os

from dotenv import load_dotenv
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://example.com")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN topilmadi. .env fayliga BOT_TOKEN=... qo'shing.")

logging.basicConfig(level=logging.INFO)

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


def main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🔍 Usta qidirish",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=search")
        )],
        [InlineKeyboardButton(
            text="🧰 Usta bo'lib ro'yxatdan o'tish",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=register")
        )],
    ])


@dp.message(CommandStart())
async def start_handler(message: Message):
    text = (
        f"Assalomu alaykum, {message.from_user.first_name}! 👋\n\n"
        "Bu bot orqali sizga kerakli <b>ustani tez topishingiz</b> yoki "
        "o'zingiz usta bo'lsangiz, <b>mijozlar topishingiz</b> mumkin.\n\n"
        "Quyidagi tugmalardan birini tanlang 👇"
    )
    await message.answer(text, reply_markup=main_keyboard(), parse_mode="HTML")


@dp.message(F.text == "/ustalar")
async def ustalar_handler(message: Message):
    await start_handler(message)


async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
