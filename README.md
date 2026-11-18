# Shoir va yozuvchi sayti

Zamonaviy, bir sahifali shaxsiy sayt (och/to‘q mavzu, mobilga moslashgan) va **admin panel** — barcha matn, she’r, kitob, yangilik va rasmlar (jumladan bosh sahifadagi portret) panel orqali kiritiladi.

**Aloqa**: 18 ta platforma (Telegram, Instagram, telefon, WhatsApp, Facebook, imo, Kabutar, Threads, X, YouTube, TikTok va h.k.) ikonlar bilan — admin paneldan tanlanadi, to‘ldirilganlari saytda chiqadi. Brend ikonlari: simple-icons (CC0).

**Media** bo‘limi: rasm (kattalashtirib ko‘rish), video va audio playerlar; yorliqlar orqali tur tanlanadi. Video uchun YouTube havolasi ham mumkin.

Hech qanday tashqi paket kerak emas — faqat Node.js 18+.

## Ishga tushirish

```bash
ADMIN_PASSWORD="o‘zingizning-kuchli-parolingiz" npm start
```

- Sayt: http://localhost:3000
- Admin: http://localhost:3000/admin  (standart parol `admin123` — **albatta o‘zgartiring**)

Muhit o‘zgaruvchilari: `ADMIN_PASSWORD`, `PORT` (3000), `SESSION_SECRET` (ixtiyoriy; berilsa serverni qayta ishga tushirganda sessiya saqlanadi).

## Ma’lumotlar
- `data/content.json` — admin paneldan saqlanadi (yo‘q bo‘lsa `data/default.json` ishlatiladi)
- `uploads/` — yuklangan fayllar: rasm (≤ 8 MB), audio MP3/OGG/WAV/M4A (≤ 60 MB), video MP4/WEBM (≤ 300 MB)

Ikkalasini ham zaxiralab turing. Internetga chiqarganda HTTPS (masalan, Caddy/nginx orqasida) ishlating.

## Litsenziya
[MIT](LICENSE)
