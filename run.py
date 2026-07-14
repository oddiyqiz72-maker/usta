# run.py
"""
UstaKerak — bot va FastAPI serverni BITTA jarayonda birga ishga tushiradi.
Render.com "Web Service" bitta portni kutadi (PORT muhit o'zgaruvchisi),
shuning uchun bot polling va API server bitta asyncio loop ichida
asyncio.gather bilan parallel ishlaydi.

24/7 ishonchlilik uchun: agar bot tomonida vaqtinchalik xatolik (tarmoq
uzilishi va h.k.) yuz bersa, u avtomatik qayta urinadi va API server
bunga qaramay ishlashda davom etadi (foydalanuvchilar webapp'dan
foydalanishda davom etaveradi).
"""

import asyncio
import logging
import os

import uvicorn

from backend.main import app
from bot import start_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ustakerak-run")


async def start_api():
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def start_bot_forever():
    """Bot qulab tushsa ham (tarmoq xatosi va h.k.), bir necha soniyadan so'ng qayta ishga tushadi."""
    delay = 5
    while True:
        try:
            await start_bot()
            # start_bot BOT_TOKEN yo'qligi sababli darhol qaytishi mumkin — qayta urinishning hojati yo'q
            return
        except Exception:
            logger.exception("Bot to'xtadi, %s soniyadan so'ng qayta ishga tushiriladi", delay)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)


async def main():
    await asyncio.gather(
        start_api(),
        start_bot_forever(),
    )


if __name__ == "__main__":
    asyncio.run(main())

