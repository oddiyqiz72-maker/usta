# -*- coding: utf-8 -*-
"""Ustak — bot va API serverni BITTA jarayonda birga ishga tushiradi."""

import asyncio
import os

import uvicorn
from dotenv import load_dotenv

load_dotenv()

from bot import run_bot
from backend.main import app


async def run_api() -> None:
    port = int(os.environ.get("PORT", 8000))
    config = uvicorn.Config(app, host="0.0.0.0", port=port, log_level="info")
    server = uvicorn.Server(config)
    await server.serve()


async def main() -> None:
    await asyncio.gather(run_bot(), run_api())


if __name__ == "__main__":
    asyncio.run(main())
