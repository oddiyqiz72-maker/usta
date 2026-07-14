# backend/constants.py
"""
UstaKerak — sohalar (SPECIALTIES) va hududlar (CITIES) ro'yxati.
Har bir soha uchun: kod, nomi, emoji, va rang belgisi (webapp'da chip/badge uchun).
Rang kodlari master kartochkalarida va "adashib ketmaslik" uchun ID belgisida ishlatiladi.
"""

SPECIALTIES = [
    {"code": "santexnik", "name": "Santexnik", "emoji": "🔧", "color": "#3E7CB1"},
    {"code": "elektrik", "name": "Elektrik", "emoji": "⚡", "color": "#C98A3D"},
    {"code": "payvandchi", "name": "Payvandchi", "emoji": "🔥", "color": "#B5482E"},
    {"code": "montajchi", "name": "Montajchi", "emoji": "🪛", "color": "#5C8A5C"},
    {"code": "duradgor", "name": "Duradgor", "emoji": "🪚", "color": "#8B5E3C"},
    {"code": "bo'yoqchi", "name": "Bo'yoqchi", "emoji": "🎨", "color": "#7B5EA7"},
    {"code": "kafelchi", "name": "Kafelchi", "emoji": "🧱", "color": "#A85C6B"},
    {"code": "gazchi", "name": "Gaz ustasi", "emoji": "🔵", "color": "#2E8B77"},
    {"code": "konditsioner", "name": "Konditsioner ustasi", "emoji": "❄️", "color": "#3E9CB1"},
    {"code": "santexnik-vannaxona", "name": "Vannaxona ustasi", "emoji": "🚿", "color": "#4A7FA6"},
    {"code": "eshik-deraza", "name": "Eshik/Deraza ustasi", "emoji": "🚪", "color": "#7A6A4F"},
    {"code": "quruvchi", "name": "Quruvchi", "emoji": "🏗️", "color": "#6B6B6B"},
    {"code": "santexnik-isitish", "name": "Isitish tizimi ustasi", "emoji": "♨️", "color": "#C9622E"},
    {"code": "mebel", "name": "Mebel yig'uvchi", "emoji": "🪑", "color": "#8A7248"},
    {"code": "boshqa", "name": "Boshqa xizmatlar", "emoji": "🛠️", "color": "#7A7A7A"},
]

SPECIALTY_MAP = {s["code"]: s for s in SPECIALTIES}

CITIES = [
    "Toshkent shahri", "Andijon", "Buxoro", "Farg'ona", "Jizzax",
    "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", "Qoraqalpog'iston",
    "Samarqand", "Sirdaryo", "Surxondaryo", "Toshkent viloyati",
]

# Foydalanuvchi/ustaga tegishli validatsiya chegaralari
AGE_MIN, AGE_MAX = 16, 90
EXPERIENCE_MIN, EXPERIENCE_MAX = 0, 70
BIO_MAX_LEN = 220

