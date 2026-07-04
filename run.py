"""
Bot va veb-server (API + Mini App)ni BITTA jarayonda birga ishga tushiradi.
Bu 1 ta server / 1 ta xizmat (masalan Render, Railway) ustida deploy qilishni osonlashtiradi.

Ishga tushirish:  python run.py
"""
import asyncio
import logging
import os

import uvicorn
from dotenv import load_dotenv

from backend.main import app as fastapi_app
from bot import bot, dp

load_dotenv()

logging.basicConfig(level=logging.INFO)


async def run_web():
    port = int(os.getenv("PORT", 8000))
    config = uvicorn.Config(fastapi_app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def run_bot():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


async def main():
    await asyncio.gather(run_web(), run_bot())


if __name__ == "__main__":
    asyncio.run(main())
