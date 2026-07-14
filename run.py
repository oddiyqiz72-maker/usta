# run.py
"""
UstaKerak — bot va FastAPI serverni BITTA jarayonda birga ishga tushiradi.
Render.com "Web Service" bitta portni kutadi (PORT muhit o'zgaruvchisi),
shuning uchun bot polling va API server bitta asyncio loop ichida
asyncio.gather bilan parallel ishlaydi.
"""

import asyncio
import os

import uvicorn

from backend.main import app
from bot import start_bot


async def start_api():
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def main():
    await asyncio.gather(
        start_api(),
        start_bot(),
    )


if __name__ == "__main__":
    asyncio.run(main())
