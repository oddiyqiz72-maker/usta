# Usta sohalari (kod -> ko'rinadigan nom + emoji)
SPECIALTIES = [
    {"code": "santexnik", "label": "Santexnik", "emoji": "🔧"},
    {"code": "elektrik", "label": "Elektrik", "emoji": "⚡"},
    {"code": "payvandchi", "label": "Payvandchi", "emoji": "🔗"},
    {"code": "boyoqchi", "label": "Bo'yoqchi", "emoji": "🎨"},
    {"code": "duradgor", "label": "Duradgor (yog'och usta)", "emoji": "🪚"},
    {"code": "qurilishchi", "label": "Qurilishchi / Betonchi", "emoji": "🧱"},
    {"code": "kafelchi", "label": "Kafelchi", "emoji": "🀄"},
    {"code": "konditsioner", "label": "Konditsioner / Muzlatgich ustasi", "emoji": "🧊"},
    {"code": "mebel", "label": "Mebel yig'uvchi", "emoji": "🛋️"},
    {"code": "kompyuter", "label": "Kompyuter / Telefon ustasi", "emoji": "💻"},
    {"code": "avtomexanik", "label": "Avtomexanik", "emoji": "🚗"},
    {"code": "gazchi", "label": "Gaz-plita ustasi", "emoji": "🔥"},
    {"code": "boshqa", "label": "Boshqa", "emoji": "🧰"},
]

# Hududlar
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

SPECIALTY_MAP = {s["code"]: s for s in SPECIALTIES}
