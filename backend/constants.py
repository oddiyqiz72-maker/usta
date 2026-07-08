# -*- coding: utf-8 -*-
"""Ustak — doimiy ro'yxatlar: sohalar va hududlar."""

# key -> (nomi, emoji)  — eski (real ishlab turgan) loyihadagi ro'yxat bilan bir xil
SPECIALTIES = {
    "santexnik": ("Santexnik", "🔧"),
    "elektrik": ("Elektrik", "⚡"),
    "payvandchi": ("Payvandchi", "🔗"),
    "boyoqchi": ("Bo'yoqchi", "🎨"),
    "duradgor": ("Duradgor (yog'och usta)", "🪚"),
    "qurilishchi": ("Qurilishchi / Betonchi", "🧱"),
    "kafelchi": ("Kafelchi", "🀄"),
    "konditsioner": ("Konditsioner / Muzlatgich ustasi", "🧊"),
    "mebel": ("Mebel yig'uvchi", "🛋️"),
    "kompyuter": ("Kompyuter / Telefon ustasi", "💻"),
    "avtomexanik": ("Avtomexanik", "🚗"),
    "gazchi": ("Gaz-plita ustasi", "🔥"),
    "boshqa": ("Boshqa", "🧰"),
}

# Eski (real) loyihadagi hudud ro'yxati bilan bir xil
CITIES = [
    "Toshkent shahri",
    "Toshkent viloyati",
    "Andijon",
    "Farg'ona",
    "Namangan",
    "Samarqand",
    "Buxoro",
    "Navoiy",
    "Qashqadaryo",
    "Surxondaryo",
    "Jizzax",
    "Sirdaryo",
    "Xorazm",
    "Qoraqalpog'iston",
]


def specialty_label(key: str) -> str:
    item = SPECIALTIES.get(key)
    if not item:
        return key
    name, emoji = item
    return f"{emoji} {name}"
