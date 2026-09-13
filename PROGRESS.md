# BarakaSELL Lite — progress

Oxirgi yangilanish: 2026-09-13. To'liq spec: `plan/plan.md`. Dizayn handoff:
`plan/design_handoff_barakasell_lite/README.md`.

## Holat

**2-milestone (sotuv oqimi) va admin'ning barcha rejalashtirilgan
sahifalari to'liq tugallandi.** Kirim, inventarizatsiya, smena, sotuv
(aralash to'lov + nasiya), qaytarish — backend to'liq ishlaydi va test
qilingan (48 test). POS'ning barcha 10 ekrani ishlaydi (Login/PIN, Smena
ochish, Sotuv, To'lov, Yakun, Bugungi sotuvlar, Qaytarish, Kassa harakati,
Smena yopish, Nasiya mijozlari) — offline savat+navbat va barcha
PIN-gated amallar brauzerda qo'lda tasdiqlangan. Admin'da barcha 9
sahifa (Tovarlar, Kirimlar, Yetkazib beruvchilar, Dashboard, Mijozlar,
Hisobotlar, Audit, Foydalanuvchilar, Sozlamalar) tayyor va tasdiqlangan.
**Qolgan ish**: faqat Excel import (`ImportJob`/`ImportRow` — na backend,
na UI, alohida keyingi milestone).

Monorepo: pnpm workspace, root'da `docker-compose.yml` (Postgres 16, port
5434 — 5433 boshqa loyiha band qilgan).

```
apps/
  api/     — NestJS + Prisma + Postgres (to'liq ishlaydi: ombor + sotuv + hisobot)
  admin/   — Next.js 16 (barcha 9 sahifa ishlaydi, Excel import bundan mustasno)
  pos/     — Vite React + Tailwind v4 + PWA (barcha 10 ekran ishlaydi)
```

---

## Amalga oshirilgan modellar (`apps/api/prisma/schema.prisma`)

Schema **to'liq** yozilgan va endi **to'liq implement qilingan** (`ImportJob`/
`ImportRow` — Excel import — bundan mustasno, u hali keyingi milestone).

| Model | Asosiy maydonlar | Izoh |
|---|---|---|
| `User` | name, login?, passwordHash?, pinHash?, role(ADMIN/CASHIER), status | Admin: login+parol. Kassir: PIN |
| `Category` | name (unique) | |
| `Product` | sku, name, categoryId?, baseUnitLabel, **avgCost**, **stock**, lastLedgerSeq, isActive | `stock`/`avgCost` — KESH, ledger'dan hisoblanadi. `salePrice` YO'Q — narx `ProductUnit.price`da |
| `ProductUnit` | productId, label, factor, price, isBase, sortOrder | `price` — o'sha birlikdan BITTASINING narxi (baza narx × factor emas) |
| `Barcode` | code (unique), productId, isInternal | Bir tovarda ko'p barcode, unit'ga bog'lanmagan |
| `StockLedgerEntry` | seq(BigInt autoincrement), productId, type, qtyDelta, balanceAfter, unitCost, costDelta, avgCostAfter, refType/refId/refLineId | **Append-only**, hech kim UPDATE/DELETE qilmaydi |
| `Supplier` | name, contactPerson, phone | `contactPerson` admin'ning Yetkazib beruvchilar sahifasi uchun qo'shildi |
| `Receipt` / `ReceiptLine` | code(K-000001), status(DRAFT/POSTED/VOIDED), idempotencyKey; qtyInUnit/qtyBase, unitCostPack/unitCostBase | Kirim hujjati |
| `InventoryCount` / `InventoryCountLine` | code(INV-000001), status, totalDiffValue; expectedQty/countedQty/diffQty/unitCost/diffValue | Inventarizatsiya |
| `Shift` / `CashMovement` | openingCash/expectedCash/countedCash/diffCash; type(IN/OUT), amount, reason | Smena. `openedById` bo'yicha bitta foydalanuvchida bir vaqtda faqat bitta OPEN smena |
| `Sale` / `SaleLine` / `SaleTender` | code(#4821), idempotencyKey(unique, majburiy); qtyBase, **unitCostBase (snapshot)**, lineCost, returnedQtyBase; type(CASH/CARD/CLICK/CREDIT) | Sotuv. `unitCostBase` sotuv payhtidagi avgCost — keyin o'zgarmaydi |
| `SaleReturn` / `SaleReturnLine` | code(Q-000001), refundTotal, refundTender(bitta usul), costReversed; qtyBase, refundAmount, unitCostBase(original snapshot) | Qaytarish |
| `Customer` / `CustomerDebtEntry` | debtBalance(kesh); seq(BigInt), type(CREDIT_SALE/PAYMENT/RETURN_CREDIT/ADJUSTMENT), amount(**signed**), balanceAfter | Nasiya — qoldiq/tannarx bilan bir xil ledger pattern |
| `AuditLog` | action, entity, entityId?, detail(Json), userId?, ip? | |
| `Settings` | id=1 (singleton), allowNegativeStock, roundingMode, lastClosedPeriodAt | |
| `ImportJob`, `ImportRow` | — | Jadval bor, **kod yo'q** — Excel import milestone'i |

Tip qarorlari: pul `Decimal(14,2)`, birlik tannarxi `Decimal(18,6)`, miqdor
har doim baza birlikda `Decimal(18,6)` (kasr — `kg` kabi birliklar uchun).

Prisma versiyasi: **7.10.0** (breaking change: schema'da `url` yo'q, config
`apps/api/prisma7.config.ts`da; generator `prisma-client` (yangi), client
`apps/api/src/generated/prisma/` ga generatsiya qilinadi — gitignore'da;
`@prisma/adapter-pg` orqali ulanadi, oddiy `DATABASE_URL` bilan emas).

Migratsiyalar: `20260912130213_init`, `20260912130300_code_sequences`
(`sale_code_seq`/`receipt_code_seq`/`return_code_seq`/`count_code_seq`),
`20260912161412_add_sales_indexes` (`Sale.status+soldAt`,
`SaleReturn.shiftId`, `SaleReturnLine.saleLineId`,
`CustomerDebtEntry.refType+refId`/`.occurredAt`).

---

## Asosiy servislar (interfeys darajasida)

### `StockService` (`modules/inventory/stock.service.ts`)

`Product.stock` va `Product.avgCost`ga yozadigan **yagona** joy. Hech qanday
boshqa kod bu ikki maydonga to'g'ridan-to'g'ri yozmaydi. Sotuv/qaytarish
ham xuddi kirim/inventarizatsiya kabi shu orqali yozadi — ikkinchi
qoldiq-hisoblash yo'li yo'q.

- `lockProducts(tx, productIds[])` — berilgan tovarlarni ID bo'yicha o'sish
  tartibida `SELECT ... FOR UPDATE` bilan lock qiladi (deadlock oldini olish
  uchun tartib qat'iy). Chaqiruvchi hujjatning BARCHA qatorlari uchun buni
  bir marta, tranzaksiya boshida chaqiradi.
- `applyMovement(tx, {productId, type, qtyDelta, unitCost?, refType, refId, ...})`
  — bitta harakatni qo'llaydi: `costing.util.ts`dagi sof formula bilan yangi
  qoldiq/tannarxni hisoblaydi, `StockLedgerEntry` yozadi, `Product` keshini
  yangilaydi. `type=SALE`da manfiy qoldiqqa `Settings.allowNegativeStock`
  tekshiradi.
- `verify()` / `repair()` — kesh vs ledger drift tekshiruvi/tuzatishi.
- `listLedger(filter)`, `movementsForProduct(id)` — o'qish uchun yordamchi.

Moving average formulasi — `modules/inventory/costing.util.ts`dagi
`computeCosting()` sof funksiya (DB'siz, to'liq unit-testlangan): RECEIPT
(blend/reset), SALE (avgCost o'zgarmaydi, joriy avgCost snapshot qilinadi),
RETURN (original sotuv snapshot narxida qo'shiladi), COUNT_ADJUST (joriy
avgCost bilan baholanadi).

### `CustomerDebtService` (`modules/customers/customer-debt.service.ts`)

`StockService`ning nasiya-tomonidagi egizagi. `Customer.debtBalance`ga
yozadigan **yagona** joy, `CustomerDebtEntry.balanceAfter` bilan
kumulyativ-snapshot pattern (`StockLedgerEntry` bilan bir xil g'oya).

- `write(tx, {customerId, type, amount, refType?, refId?, tender?, userId, note?})`
  — mijozni `FOR UPDATE` bilan lock qiladi. **Ishora konvensiyasi**: `amount`
  parametr CREDIT_SALE/PAYMENT/RETURN_CREDIT uchun **musbat miqdor** sifatida
  beriladi, lekin `PAYMENT`/`RETURN_CREDIT` uchun yozuvga **manfiy** yoziladi
  (qarz kamayishi), chunki `CustomerDebtEntry.amount` qarz balansiga
  ta'sirini ifodalaydi — naqd oqimini emas. `ShiftsService.computeExpectedCash`
  shuning uchun bu yig'indini **ayiradi** (manfiy sondan ayirish = qo'shish).
  Bu ishora nomuvofiqligiga sabab bo'lgan haqiqiy bug edi, testlar bilan
  topilib tuzatildi (pastda "Sinov paytida topilgan xatolar" bo'limida).

### `ShiftsService` (`modules/shifts/shifts.service.ts`)

- `open/close/current/findOpenShift/requireOpenShift/addCashMovement`.
  Bir foydalanuvchida bir vaqtda faqat bitta `OPEN` smena (409 aks holda).
  `close`/`addCashMovement` faqat smena egasi yoki ADMIN tomonidan.
- `computeExpectedCash` — formula: `openingCash + Σ naqd SaleTender (shift
  ichida, COMPLETED) − Σ naqd SaleReturn.refundTotal + naqd
  CustomerDebtEntry(PAYMENT, refType='Shift', refId=shiftId) + Σ CashMovement
  IN − Σ OUT`. Nasiya to'lovi naqd bo'lib, to'lov paytida ochiq smena bo'lsa,
  shu formula orqali smena kassasiga tushadi.
- `requireOpenShift(userId)` — Sales/Returns servislari shundan foydalanadi:
  sotuv/qaytarish HAR DOIM chaqiruvchining o'z ochiq smenasiga yoziladi,
  so'rov tanasida `shiftId` qabul qilinmaydi.

### `SalesService` (`modules/sales/sales.service.ts`)

`POST /sales` — bitta tranzaksiyada: `lockProducts` → har qator uchun
`ProductUnit`dan narx/factor o'qish → `applyMovement(type:SALE)` (qaytgan
`unitCost` `SaleLine.unitCostBase`ga SNAPSHOT sifatida yoziladi) →
`SaleTender` qatorlari → nasiya bo'lsa `CustomerDebtService.write(CREDIT_SALE)`
→ `cogsTotal` yangilanadi → audit. Tranzaksiya COMMIT'dan KEYIN
`FISCAL_GATEWAY.registerSale()` (hozir no-op).

- **Idempotency**: `Idempotency-Key` header **majburiy** (400 aks holda).
  `Sale.idempotencyKey` unique — mavjud bo'lsa yangi yozuv yaratilmaydi,
  bor sotuv qaytariladi. `POST /sales/sync` — massiv, har element o'z
  kalitidagi bilan mustaqil (`created`/`duplicate`/`failed`).
- **Aralash to'lov**: `settleTenders()` — faqat CASH qaytim (o'zgarim)
  berishi mumkin; boshqa usullar (CARD/CLICK/CREDIT) avval qoplaydi, ortiqcha
  naqd qaytim bo'ladi. `paidAmount` har doim `total`dan oshmaydi.
- **Rounding**: `settingsService.get().roundingMode` orqali
  `applyRounding()` (`modules/settings/rounding.util.ts`) chaqiriladi.

### `ReturnsService` (`modules/returns/returns.service.ts`)

`POST /returns`, `@RequiresPinConfirmation()`. Qaytarish miqdori
`SaleLine.qtyBase − returnedQtyBase`dan oshmasa (409 aks holda).
`applyMovement(type:RETURN, unitCost: saleLine.unitCostBase)` — original
snapshot narxda. `refund.util.ts`dagi `computeRefund()` — qatorning
qaytariladigan qismini proporsional hisoblaydi, sotuv darajasidagi umumiy
chegirmani ustiga qo'llaydi (`roundingAdj`ga QASDAN tegilmaydi — bir martalik
tiyin tuzatishi qaytarishlarga bo'linib ketmasin uchun).

### `ReportsService` (`modules/reports/reports.service.ts`)

Avval controller `PrismaService`ga to'g'ridan-to'g'ri yozardi (bitta
`/stock-value` metodi); endi 5 metodli servis, controller nozik qatlam.
**`/reports/stock-value` javob shakli o'zgarmagan** (`counts.e2e-spec.ts`
shunga tayanadi — regression testi `reports.e2e-spec.ts`da bor).

- `stockList()` — Qoldiq hisoboti qatorlari (`/reports/stock`).
- `dashboard()` — bugungi tushum/foyda (soddalashtirish: `roundingAdj`
  hisobga olinmaydi), naqd farqi, ochiq smenalar soni, top-5 sotilgan
  (bugungi `Sale.lines`ni JS'da reduce qilib — `SaleLine.productId`
  munosabatsiz, Prisma join yo'q), kam qolgan-5, oxirgi 10 smena +
  har birining tushumi (`Sale.groupBy(['shiftId'])` BITTA so'rovda — N+1
  emas).
- `profitReport({from,to,groupBy})` — Foyda-zarar, 3 kesim: `period`
  (kunlik, `Sale` darajasida), `product`/`category` (`SaleLine` darajasida,
  `category` uchun productId→kategoriya xaritasi alohida so'ralib JS'da
  merge qilinadi — `SaleLine`da `Product` munosabati yo'qligi sababli).
  "Lite" hajm uchun SQL groupBy shart emas, JS reduce yetarli.
- `deadStock(days)` — `StockLedgerEntry.groupBy(['productId'], where:
  {type:'SALE'}, _max:{occurredAt})` + barcha faol tovar bilan JS'da
  merge — hech qachon sotilmagan yoki `days`dan eski tovarlar.

### Audit (`common/interceptors/audit.interceptor.ts` + `modules/audit/`)

- `@Audit({action, entity})` dekoratori — controller metodiga qo'yiladi.
- `AuditInterceptor` — global, handler muvaffaqiyatli tugagandan keyin
  ishlaydi, `result.id`ni (yoki `request.params.id`ni) `entityId`ga yozadi.
  **`entityId` endi `String(...)`ga o'raladi** — `Settings.id` kabi `Int`
  PK'lar uchun Prisma xato berardi (pastda "Sinov paytida topilgan
  xatolar"da tafsilot).
- Tranzaksiya ICHIDA yozish kerak bo'lganda `AuditService.write(tx, {...})`.

### Auth (`modules/auth/`)

- JWT (`@nestjs/jwt`), 3 ta global guard: `JwtAuthGuard` → `RolesGuard` →
  `PinConfirmationGuard`. `@Public()`, `@Roles(UserRole.ADMIN)`,
  `@RequiresPinConfirmation()` (60s `X-Pin-Confirmation` token,
  `POST /auth/confirm-pin` beradi).
- **Xavfsizlik chegarasi eslatmasi**: offline PIN tekshiruvi (POS milestone)
  UX darvozasi, xavfsizlik chegarasi emas.

---

## Konventsiyalar

- **Papka strukturasi**: `src/common/` (Prisma, decorator, guard, interceptor
  — domendan mustaqil narsalar) + `src/modules/<domen>/` (har bir domenda
  `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`).
- **Import**: `moduleResolution: nodenext` — barcha nisbiy import `.js`
  bilan tugaydi (`from './foo.js'`), TypeScript fayl bo'lsa ham. Admin
  ilovada (`bundler` resolution) esa **`.js` YO'Q**, `@/` alias ishlatiladi.
- **Pul/miqdor hisob**: har doim `Prisma.Decimal`, hech qachon JS `number`
  bilan emas (servis darajasida). Controller/DTO darajasida `number` kirish
  qabul qilinadi, service ichida `Decimal`ga o'giriladi.
- **Yagona yozish yo'li**: har bir domen uchun bitta "manba" servis bor
  (`StockService` — qoldiq/tannarx, `CustomerDebtService` — nasiya balansi,
  `AuditService` — audit). Boshqa hech qanday kod bu jadvallarga
  to'g'ridan-to'g'ri yozmaydi.
- **Ledger/kesh ishora konvensiyasi**: bir ledger yozuvining `amount`/
  `qtyDelta` maydoni har doim **o'zi ta'sir qiladigan balansga nisbatan
  signed** bo'lishi kerak (`StockLedgerEntry.qtyDelta` — qoldiqqa,
  `CustomerDebtEntry.amount` — qarz balansiga). Boshqa hisob-kitob (masalan
  "bu naqd oqimimi?") ishorani chaqiruvchi tomonda hal qilinadi, ledger
  yozuvining o'zida emas — `ShiftsService.computeExpectedCash`dagi kabi.
- **Tranzaksiya**: hujjat darajasida bitta `prisma.$transaction`, qator
  darajasida emas. Bir nechta tovar/mijoz lock qilinganda ID bo'yicha
  o'sish tartibida (deadlock oldini olish).
- **Idempotency**: faqat client tomonidan "qayta yuborilishi mumkin"
  operatsiyalarda (`Sale`, `Receipt`, `SaleReturn` — hammasi
  `idempotencyKey` unique maydon bilan). Kalit topilsa YANGI yozuv
  yaratilmaydi, mavjudi qaytariladi — xato emas.
- **Xato javoblari**: Nest built-in exception'lar (`BadRequestException`,
  `ConflictException`, `NotFoundException`) — `{message, statusCode}` shakli,
  frontend `ApiError`ga o'raladi.
- **Sequence-based kodlar**: `Sale.code`(`#4821`)/`Receipt.code`(`K-000001`)/
  `SaleReturn.code`(`Q-000001`)/`InventoryCount.code`(`INV-000001`) —
  Postgres `SEQUENCE` orqali, counter-row emas — parallel yozuvda tiqilib
  qolmaydi.
- **Test yozish uslubi**:
  - Sof hisob-kitob (`costing.util`, `rounding.util`, `refund.util`) —
    `*.spec.ts`, DB'siz, Vitest globals, `Prisma.Decimal` bilan solishtirish
    `.toString()` orqali.
  - Integratsiya — `*.e2e-spec.ts`, `test/` papkasida, haqiqiy Postgres'ga
    ulanadi, har testda butun `AppModule` ko'tariladi.
  - **Barcha e2e testlar bitta umumiy Postgres bazasini ishlatadi**
    (`fileParallelism: false`). Smena-bog'liq testlarda **har bir
    `beforeEach` avval joriy ochiq smenani yopadi** (keyin kerak bo'lsa
    yangisini ochadi) — aks holda keyingi test fayli eskisining ustiga
    yozib, sonlar chalkashib ketadi (bu aynan shu bug tufayli bir marta
    ushlangan — pastga qarang).
  - `current.body.expectedCash` kabi API'dan qaytgan Decimal maydonlar JSON
    orqali **string** bo'lib keladi — smena yopishda `countedCash`ga qayta
    yuborishdan oldin **albatta `Number(...)`ga o'girish kerak**, aks holda
    `@IsNumber()` DTO validatsiyasi jimgina 400 qaytaradi va tozalash
    ishlamay qoladi.
  - Har bir e2e test o'zining SKU'sini `Date.now()` bilan generatsiya qiladi
    — testlar orasida ma'lumot to'qnashmasin (baza tozalanmaydi, real Postgres
    saqlanib qoladi, shuning uchun dev bazada test data to'planib qoladi —
    ziyoni yo'q, faqat vizual shovqin admin UI'da).

### Sinov paytida topilgan xatolar (ikkalasi ham tuzatildi)

Sotuv/smena e2e testlarini yozish paytida ikkita haqiqiy prod-kod bugi
ushlandi (ikkalasi ham endi tuzatilgan, testlar bilan qoplangan):

1. **`ShiftsService.computeExpectedCash` ishora xatosi** — nasiya to'lovini
   `.plus()` bilan qo'shardi, lekin `CustomerDebtEntry.amount` PAYMENT uchun
   manfiy saqlanadi (qarz balansiga ta'siri), shuning uchun naqd to'lov
   smena kassasidan **ayilib** ketardi. Tuzatildi: `.minus()`.
2. **`AuditInterceptor` `entityId` turi** — `result.id` ba'zan `Int` (masalan
   `Settings.id=1`), lekin `AuditLog.entityId` ustuni `String?`. Prisma
   `PrismaClientValidationError` bilan yiqilardi (fire-and-forget bo'lgani
   uchun asosiy so'rovni buzmasdi, lekin audit yozuvi yo'qolardi). Tuzatildi:
   `entityId`ni har doim `String(...)`ga o'rash.

---

## Testlar (48 ta backend, hammasi o'tadi)

**Unit** (18 test, DB'siz):
- `modules/inventory/costing.util.spec.ts` (8) — moving average formulasi.
- `modules/settings/rounding.util.spec.ts` (5) — NONE/R10/R100/R1000,
  yaxlitlash yo'nalishi, aniq qiymat.
- `modules/returns/refund.util.spec.ts` (5) — to'liq/qisman qaytarish,
  sotuv darajasidagi chegirma proratsiyasi, tiyin darajasida yaxlitlash.

**E2E** (30 test, `apps/api/test/*.e2e-spec.ts`):

| Fayl | Tekshiradi |
|---|---|
| `app.e2e-spec.ts` | `GET /api/health` DB'ga ulanganini |
| `auth.e2e-spec.ts` | Admin/kassir login, PIN-guard 403, `GET /auth/cashiers` public+parolsiz |
| `catalog.e2e-spec.ts` | Ko'p birlik, dublikat barcode, ichki EAN-13 |
| `receiving.e2e-spec.ts` | Ikki kirim → aniq blend, kesh=ledger, qayta post 409 |
| `concurrency.e2e-spec.ts` | 20 parallel kirim → ketma-ket natijaga teng |
| `inventory-verify.e2e-spec.ts` | Drift topish/tuzatish |
| `counts.e2e-spec.ts` | Kamomad → stock tushadi, avgCost o'zgarmaydi |
| `shifts.e2e-spec.ts` | Ochish/ikkinchi ochish 409, PIN'siz kassa harakati 403, `expectedCash`/`diffCash` formulasi |
| `sales.e2e-spec.ts` | Smenasiz sotuv 409, aralash to'lov, `unitCostBase` snapshot (keyingi kirimdan keyin ham o'zgarmasligi), idempotency retry, manfiy qoldiq 409/ruxsat bilan o'tishi, `Idempotency-Key`siz 400 |
| `sales-sync.e2e-spec.ts` | Batch: created/duplicate(qayta yuborilgan key)/failed |
| `returns.e2e-spec.ts` | PIN'siz 403, qisman qaytarish original snapshot narxda, ortiqcha qaytarish 409 |
| `credit.e2e-spec.ts` | Nasiya sotuv qarzni oshiradi, to'lov kamaytiradi (`balanceAfter` ketma-ketligi), naqd to'lov smena `expectedCash`iga tushishi, mijozsiz CREDIT tender 400 |
| `reports.e2e-spec.ts` | `/reports/dashboard` shakli, `/reports/dead-stock` sotilmagan tovarni topishi, `/reports/stock-value` shakli o'zgarmaganligi (regression) |
| `suppliers.e2e-spec.ts` | `contactPerson` saqlanishi, `totalPurchase` faqat POSTED kirimlardan hisoblanishi (qoralama hisobga kirmasligi) |

Ishga tushirish: `pnpm --filter @barakasell/api test` (unit),
`pnpm --filter @barakasell/api test:e2e` (integratsiya, Postgres kerak:
`docker compose up -d db`).

---

## Admin UI

**1-milestone**: `/login`, `/products` (ro'yxat+filtr+yangi tovar modal),
`/products/[id]` (birliklar, barcode, harakat tarixi), `/receipts`
(ro'yxat), `/receipts/[id]` (`id==="new"` — yaratish rejimi ham shu sahifada).

**Sotuv oqimiga oid 6 sahifa** (endi tayyor, brauzerda tasdiqlangan):
- `/dashboard` — 4 KPI karta (`CornerMarks` birinchi marta ishlatildi),
  top sotilgan/kam qolgan ro'yxatlari, oxirgi smenalar jadvali. Bitta
  `GET /reports/dashboard` chaqiruvi. Login'dan keyingi va bosh `/`
  redirect endi shu sahifaga (`/products`dan o'zgardi).
- `/customers` — master/detail mijozlar+nasiya, POS'dagi bilan **bir xil**
  `Customer`/`CustomerDebtEntry` ma'lumotiga ulanadi (POS'da yaratilgan
  qarz shu yerda ko'rinadi — qo'lda tasdiqlangan).
- `/reports` — 4 tab (Qoldiq/Foyda-zarar/Smenalar/Harakatsiz), bitta
  sahifa ichida segment almashtirish (alohida route emas).
- `/audit` — filtrlanadigan audit jurnali, amal-nomiga qarab rangli tag.
- `/users` — foydalanuvchilar, "+ Yangi", holat almashtirish, **PIN
  tiklash** (`POST /auth/confirm-pin` → `X-Pin-Confirmation` header bilan
  `PATCH /:id/pin` — ikki bosqichli modal, uchdan-uchiga brauzerda
  tasdiqlangan).
- `/settings` — `allowNegativeStock` toggle, `roundingMode` radio,
  "Davrni yopish" **ataylab disabled** (bu maydonni yozadigan endpoint
  yo'q — yangi biznes-qoida, keyingi bosqich).
- `/suppliers` — 1-milestone'dan qolgan bo'sh joy, endi to'ldirildi:
  nomi/mas'ul shaxs/telefon/oxirgi kirim sanasi/jami xarid summasi.
  Oxirgi ikkitasi backend'da hisoblanadi (`SuppliersService.findAll()` —
  `Receipt`larni JS'da reduce qilib, `oxirgi kirim` — istalgan holatdagi
  eng so'nggi `createdAt`, `jami xarid` — faqat POSTED hujjatlar). Buning
  uchun `Supplier`ga `contactPerson` maydoni qo'shildi (migration
  `add_supplier_contact_person`).

Navigatsiya: `(protected)/layout.tsx`dagi `NAV` massivi 9 punktga o'sdi
(Dashboard birinchi). Rol himoyasi: `user.role !== 'ADMIN'` bo'lsa to'liq
ekranli "Ruxsat yo'q" (amaliyotda kassir admin login formasidan token
ololmaydi, bu qo'shimcha himoya qatlami).

`lib/api.ts`ning `patch()`iga `extraHeaders` parametri qo'shildi (PIN
tiklash uchun `X-Pin-Confirmation` yuborish — `post`/`delete`da allaqachon
bor edi).

Auth: JWT `localStorage`da (**httpOnly cookie EMAS**). `/lib/api.ts` — fetch
wrapper, `/lib/auth-context.tsx` — React context, `/lib/format.ts` — so'm/
miqdor formatlash.

Dizayn tokenlari `globals.css`da (`@theme` blok): fon `#f2f2f3`, accent
`#5980a6`, Barlow/Barlow Condensed, kvadrat burchaklar.

**Yo'q**: Excel import (alohida keyingi milestone).

**Ma'lum, tuzatilmagan lint holati**: `pnpm --filter @barakasell/admin lint`
`react-hooks/set-state-in-effect` qoidasi bo'yicha bir nechta xato beradi —
ba'zilari ESKI, mendan oldingi fayllarda (`products/[id]/page.tsx`,
`receipts/[id]/page.tsx`), qolgani sotuv-oqimi bosqichida qo'shilgan
sahifalarda — hammasi bitta pattern (`useEffect(() => { load(); },
[load])`). Bu
loyihada allaqachon o'rnatilgan konvensiya, `next build` (haqiqiy
build/deploy gate) muvaffaqiyatli o'tadi — faqat alohida `lint` buyrug'i
buni yangi(roq) qoidasi bilan belgilaydi. Butun kodbazani qayta yozish
qamrovdan tashqari, faqat qayd etib qo'yildi.

---

## POS ilovasi (`apps/pos`) — barcha 10 ekran tayyor

Stack: Vite + React 19, **Tailwind v4** (admin bilan bir xil design token'lar
— `src/index.css`, Google Fonts orqali Barlow/Barlow Condensed, chunki
Vite'da `next/font` yo'q), **`idb`** (IndexedDB wrapper, offline savat+
navbat uchun), **`vite-plugin-pwa`** (plan.md'ning "PWA" stack qarori —
app-shell precache + service worker, `pnpm build` paytida generatsiya
qilinadi). Router YO'Q — dizayn handoff'ning "internal state machine"
patterniga mos, bitta `AppContext` (`useReducer`, patch-style: har action
`Partial<AppState>` yuboradi) ekranlarni almashtiradi.

Tayyor ekranlar (`src/screens/`), barchasi 10 tasi ham:
`LoginScreen` (kassir plitkalari + PIN, `GET /auth/cashiers` orqali —
yangi public endpoint, pastga qarang), `ShiftOpenScreen`, `SaleScreen`
(qidiruv+barcode, kategoriya chip, tovar grid, savat paneli, hamburger →
`Drawer`), `PaymentScreen` (Aralash/Nasiya segment), `SaleCompleteScreen`,
`SalesTodayScreen` (bugungi sotuvlar, qator kengaytirilib "Qaytarish"ga
o'tadi), `ReturnsScreen` (kod bo'yicha qidiruv yoki oldindan to'ldirilgan,
qty-stepper, `PinConfirmModal`), `CashMovementScreen` (IN/OUT,
`PinConfirmModal`, joriy smena harakatlari ro'yxati), `ShiftCloseScreen`
(kutilgan/sanalgan/farq, yopilgach `logout()`), `CreditCustomersScreen`
(qidiruv+detail+to'lov, `PaymentScreen`ning Nasiya tab'i bilan bir xil
pattern).

**Yangi umumiy komponentlar**: `components/PinConfirmModal.tsx` (dizaynning
"PIN reconfirmation modal" — `POST /auth/confirm-pin` bilan kassirning o'z
PIN'ini tasdiqlaydi, natijadagi token keyingi so'rovga `X-Pin-Confirmation`
sifatida beriladi — Qaytarish va Kassa harakati shuni ishlatadi),
`components/Drawer.tsx` (hamburger menyu).

**Navigatsiya kengaytirildi**: `state/app-context.tsx`ga umumiy
`goTo(screen)` va `openReturnsFor(saleCode|null)` action qo'shildi.
`refreshShift()`ning xulqi TUZATILDI — avval ekranni majburan
`sale`/`shiftOpen`ga o'tkazardi (faqat login/bootstrap uchun to'g'ri edi),
endi faqat `shift` ma'lumotini yangilaydi, navigatsiyaga tegmaydi — chunki
endi uni Qaytarish/Kassa harakati/Smena yopish ekranlaridan ham
`expectedCash`ni yangilash uchun chaqirish kerak bo'ldi.

**Offline oqim** (`src/lib/db.ts` + `src/lib/offline-sync.ts`):
- Savat har o'zgarishda `idb`ning `cart` store'iga yoziladi
  (`AppProvider`ning bootstrap effekti ochilishda o'qiydi — tablet
  qayta ochilganda savat tiklanadi).
- `checkout()` (`state/app-context.tsx`): avval `navigator.onLine`
  tekshiradi → onlayn bo'lsa `POST /sales` (header
  `Idempotency-Key: crypto.randomUUID()`). Tarmoq xatosi (fetch throw,
  `ApiError` EMAS) ushlansa → `saleQueue` store'ga yoziladi, ekranda
  "Internet yo'q — navbatga qo'yildi" ko'rinadi. `ApiError` (server
  aniq rad etgan — 409/400) esa qayta uloqtiriladi, foydalanuvchiga
  ko'rsatiladi, navbatga TUSHMAYDI (chunki bu qayta urinishda ham
  muvaffaqiyatsiz bo'ladi).
- `setupAutoSync()` — `window.addEventListener('online', flushQueue)` +
  ilova ochilganda bir marta. `flushQueue()` butun navbatni
  `POST /sales/sync`ga batch yuboradi (har biri mustaqil
  `idempotencyKey` bilan), faqat `failed` statusdagilar navbatda qoladi.
- **Qo'lda tasdiqlangan** (brauzerda `navigator.onLine`ni spoof qilib):
  offline sotuv navbatga tushishi, `OfflinePill` ko'rinishi, online
  bo'lgach avtomatik `POST /sales/sync`ga borib haqiqiy `Sale.code`
  bilan yozilishi — hammasi ishladi.

**Backend'ga qo'shilgan yagona narsa**: `GET /auth/cashiers` (`@Public()`,
faqat `{id,name}[]`, role=CASHIER — login ekranidagi plitkalar uchun,
parol/PIN chiqmaydi). `auth.controller.ts`/`auth.service.ts`ga bir metod,
`auth.e2e-spec.ts`ga bitta test.

**Qo'lda tasdiqlangan** (barcha 5 yangi ekran, brauzerda, so'ng
`GET /api/...` orqali serverda tekshirilib): Bugungi sotuvlar → qator
kengaytirish → Qaytarish (oldindan to'ldirilgan kod, qisman qaytarish,
PIN) → `returnedQtyBase` serverda yangilangani tasdiqlandi; Kassa harakati
(PIN bilan OUT 5000) → `GET /shifts/:id` orqali yozuv tasdiqlandi; Nasiya
mijozlari (to'lov 10000) → qarz kamayishi tasdiqlandi; Smena yopish
(kutilgan=sanalgan, farq 0) → smena `CLOSED` bo'lgani va Login ekraniga
qaytilgani tasdiqlandi.

**Qasddan hali kiritilmagan**:
- Qator/umumiy chegirma UI'i va PIN-gate (dizaynda bor, lekin cart faqat
  local state bo'lgani uchun soddalashtirildi).
- Ikonka/splash-screen (PWA manifest'da nom+rang bor, ikonka yo'q).

Ishga tushirish: `pnpm --filter @barakasell/pos dev` (portu 5173),
`pnpm --filter @barakasell/pos build` (tsc+vite+PWA generatsiya).

---

## Keyingi qadam: Excel import

Backend, admin va POS to'liq tugallandi — reja bo'yicha qolgan yagona
funksiya. `ImportJob`/`ImportRow` jadvallari schema'da bor, kod yo'q.
Dizayn spec (`plan/design_handoff_barakasell_lite/README.md`, 14-ekran):
3 bosqich — idle (dropzone+fayl tanlash) → ready (source-col→target-field
xaritalash jadvali, preview jadvali per-qator OK/Xato tag, xato-soni
xulosasi, "Tasdiqlash va import qilish") → done. Real implementatsiya
haqiqiy Excel parsing (masalan `xlsx`/`exceljs` kutubxonasi), ustun-
xaritalash UI'i va serverda validatsiya (5000 qatorgacha) talab qiladi —
bu boshqalardan farqli, chunki fayl yuklash+parsing+validatsiya kabi
butunlay yangi qatlam kerak, mavjud pattern'larga sodda ravishda
o'xshamaydi. Alohida reja/tadqiqot bilan boshlanishi kerak.

Ishlatiladigan pattern o'zgarmaydi: har bir yangi yozuvchi
`StockService.applyMovement()` / `CustomerDebtService.write()` orqali,
hujjat darajasida bitta tranzaksiya, `lockProducts()` bilan sortirovka
qilingan lock, audit — `@Audit()` dekorator yoki tranzaksiya ichida
`AuditService.write(tx, ...)`.
