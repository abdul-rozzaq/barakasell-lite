# BarakaSELL Lite — savdo va ombor tizimi

Kanstovarlar do'koni uchun bitta-do'kon (single-tenant) savdo, ombor va
hisobot tizimi. BarakaSell (katta, multitenant) loyihasining soddalashtirilgan
qardoshi, lekin alohida codebase.

Stack (qaror qilingan, o'zgartirmang):

- Backend: NestJS + Prisma + PostgreSQL
- Admin panel: Next.js (desktop browser, do'kon egasi uchun)
- Kassa (POS): PWA, React, Android planshetda ishlaydi
- Chek chiqarilmaydi, fiskal integratsiya yo'q, printer/hardware yo'q
- Design: [Claude Design'da tayyorlangan sahifalar — screenshot/link biriktiring]

Quyida NIMA kerakligini yozaman. QANDAY qilish (schema tafsilotlari,
service strukturasi, papka tuzilishi, qaysi pattern) — o'zing qaror qil.
Faqat quyidagi biznes qoidalarini albatta hisobga ol, chunki bular birinchi
qarashda ko'rinmaydigan, lekin real do'konda kunning birinchi kunidayoq
chiqadigan muammolar:

## Tannarx va qoldiq

- Tannarx usuli: moving average (FIFO emas). Har safar kirim bo'lganda
  o'rtacha tannarx qayta hisoblanadi
- Sotuv paytida tannarx SNAPSHOT sifatida sotuv qatoriga yoziladi va
  keyin o'zgarmaydi — hisobot retroaktiv o'zgarmasligi kerak
- Qoldiq oddiy `qty` maydon emas, harakatlar jurnali (ledger) orqali
  hisoblanadi: har bir kirim/sotuv/qaytarish/inventarizatsiya alohida
  yozuv, qoldiq shulardan yig'indi. Tezlik uchun keshlash mumkin, lekin
  har doim ledger'dan qayta hisoblab tekshirish imkoni bo'lsin
- Qoldiq nolga tushganda sotuvga ruxsat berish yoki bermaslik sozlanadigan
  bo'lsin (do'kon egasi tanlaydi)

## O'lchov birligi

- Tovar bitta baza birlikda (masalan dona) saqlanadi, lekin bir nechta
  pack/o'ram bilan keladi (1 karobka = 10 pachka = 500 dona)
- Kirimda pack tanlanadi, POS'da ham kerak bo'lsa pachka/karobka bilan
  sotish mumkin bo'lsin, ledger'ga har doim baza birlikda yoziladi

## Barcode

- Bitta tovarda bir nechta barcode bo'lishi mumkin
- Barcode'i yo'q tovarlar uchun ichki barcode generatsiya qilinsin

## To'lov

- Bitta sotuvda bir nechta to'lov usuli aralashishi mumkin (naqd + karta +
  Click bir vaqtda). To'lovni bitta enum emas, alohida qatorlar sifatida
  loyihala

## Smena

- Smena ochilganda boshlang'ich naqd kiritiladi
- Smena davomida inkassatsiya (naqd chiqarish) va qo'shimcha kiritish
  mumkin
- Smena yopilganda: tizim hisoblagan kutilgan naqd vs sotuvchi sanagan
  naqd solishtiriladi, farq alohida saqlanadi va hisobotda ko'rinadi

## Nasiya

- Mijoz kartochkasi, qarz balansi, qarz to'lash hujjati
- POS'da sotuv paytida "nasiyaga" varianti bo'lsin, mijoz tanlansin

## Qaytarish

- Sotuvdan qaytarish alohida hujjat, tannarxni ham teskari yozadi
  (foyda hisobotini buzmasligi uchun)
- Chek yo'qligi sababli qaytarish sotuv kodi yoki bugungi sotuvlar
  ro'yxatidan qidirilib amalga oshiriladi

## Inventarizatsiya

- Sanoq hujjati: kutilgan qoldiq vs sanalgan qoldiq, farq (kamomad/ortiqcha)
- Bu farq foyda-zarar hisobotiga albatta ta'sir qilishi kerak

## Audit

- Sotuvni o'chirish, chegirma berish, narxni qo'lda o'zgartirish — har biri
  kim/qachon/nima uchun bilan yoziladi

## Offline (POS)

- Internet uzilganda ham POS qidiruv va sotuvni davom ettira olishi kerak
- Sotuvlar local queue'da saqlanadi, internet qaytganda serverga
  idempotency key bilan yuboriladi (dublikat oldini olish uchun)
- Savat holati har o'zgarishda local storage'ga yozilsin (tab/planshet
  qayta ochilganda yo'qolmasin)

## Kelajakka seam (hozir amalga oshirmang, lekin joy qoldiring)

- Fiskal chek/OFD integratsiyasi keyinroq qo'shiladi. Sotuvni yopish
  logikasi shu integratsiya uchun almashtirsa bo'ladigan joy (interface/
  strategy) orqali o'tsin, hozir uning "hech narsa qilmaydigan" versiyasi
  ishlatilsin

## Auth

- Admin: login + parol
- Kassa: PIN kod. Sezgir amallar (chegirma, qator o'chirish, qaytarish)
  uchun PIN qayta so'raladi

## Scope'dan tashqari (qilmang)

Ko'p do'kon, ko'p ombor, ombor transferi, fiskal chek, loyalty dastur,
hodim maoshi, chek chop etish.

---

Boshlash tartibini, papka strukturasini, qaysi modullarni birinchi
yozishni o'zing tanla. Agar yuqoridagi qoidalardan biri boshqasi bilan
ziddiyatga kelsa (masalan offline queue va PIN qayta so'rash), qanday
hal qilishni o'zing qaror qilib, nima uchun shunday qilganingni qisqa
tushuntir.

---

## Kelajakdagi rejalar (hozircha qilinmaydi)

Loyalty, Telegram bot + AI agent va waitlist (3-milestone) tugallangandan
keyin qo'shildi — batafsil kontekst `PROGRESS.md`ning "Keyingi qadamlar"
bo'limida. Bu yerda faqat ro'yxat, aniq boshlash vaqti belgilanmagan:

1. **Egasi uchun hodisaviy/vaqtli Telegram bildirishnomalari.**
   Infratuzilma (`NotificationOutbox`, `OwnerLinkService`,
   `@nestjs/schedule`) allaqachon tayyor — faqat hodisalarni yozish
   (smena ochilishi/yopilishi, katta kassa farqi, sotuv bekor qilinishi)
   va bot tomonida `@Cron` bilan kunlik/haftalik xulosa qo'shish kerak.

2. **Kirim (chek/faktura) AI OCR.** Chek/накладной rasmini Vision model
   bilan o'qib, `Receipt` draft'ini avtomatik to'ldirish, fuzzy SKU
   moslashtirish, narx anomaliyasi ogohlantirishi. Butunlay yangi qatlam
   (fayl yuklash + Vision API + moslashtirish UI) — mavjud pattern'larga
   sodda ravishda o'xshamaydi, alohida reja/tadqiqot bilan boshlanishi
   kerak.
