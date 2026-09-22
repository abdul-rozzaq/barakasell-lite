# BarakaSELL Lite — progress

Oxirgi yangilanish: 2026-09-22. To'liq spec: `plan/plan.md`. Dizayn handoff:
`plan/design_handoff_barakasell_lite/README.md`.

## Holat

**2-milestone (sotuv oqimi), admin'ning barcha rejalashtirilgan sahifalari
va 3-milestone (loyalty + Telegram bot + AI agent + waitlist) to'liq
tugallandi.** Kirim, inventarizatsiya, smena, sotuv (aralash to'lov +
nasiya + ball bilan to'lash), qaytarish — backend to'liq ishlaydi va test
qilingan (56+ e2e test). POS'ning barcha 10 ekrani ishlaydi — offline
savat+navbat va barcha PIN-gated amallar brauzerda qo'lda tasdiqlangan.
Admin'da barcha 9 sahifa tayyor va tasdiqlangan.

**Yangi (3-milestone)**: mijozlar loyalty ball to'playdi va POS'da
ishlatadi, Telegram bot (`apps/api/src/modules/telegram-bot`, **alohida
ilova emas** — API process'ining bir qismi) orqali mijoz/egasi savol
beradi (DeepSeek AI agent), mijoz kartasini skanerlaydi, tugagan tovar
uchun so'rov qoldiradi — kirim kelganda avtomatik xabar oladi.
Batafsil: pastdagi "Loyalty" va "Telegram bot + AI agent" bo'limlari.

**Qolgan ish**: Excel import (`ImportJob`/`ImportRow` — hali kod yo'q) va
egasi uchun hodisaviy/vaqtli bildirishnomalar (smena yopilishi, kassa
farqi, kunlik xulosa — **ataylab hali qilinmagan**, faqat so'rov-javob AI
va waitlist xabarlari ishlaydi).

Monorepo: pnpm workspace, root'da `docker-compose.yml` (Postgres 16, port
5434 — 5433 boshqa loyiha band qilgan).

```
apps/
  api/     — NestJS + Prisma + Postgres: ombor + sotuv + hisobot + loyalty +
             Telegram bot + AI agent (hammasi shu process ichida)
  admin/   — Next.js 16 (barcha 9 sahifa ishlaydi, Excel import bundan mustasno)
  pos/     — Vite React + Tailwind v4 + PWA (barcha 10 ekran ishlaydi)
```

`apps/bot` **endi yo'q** — dastlab alohida Telegram bot ilovasi sifatida
qilingan edi (`ApiClient` + `X-Service-Key` orqali API'ga HTTP so'rov),
keyin bitta process'ga birlashtirildi (pastga qarang) — AI agentga yangi
imkoniyat qo'shish endi shunchaki `BotService`ga metod qo'shish, alohida
HTTP qatlam kerak emas.

---

## Amalga oshirilgan modellar (`apps/api/prisma/schema.prisma`)

Schema **to'liq** yozilgan va endi **to'liq implement qilingan** (`ImportJob`/
`ImportRow` — Excel import — bundan mustasno, u hali keyingi milestone).

| Model | Asosiy maydonlar | Izoh |
|---|---|---|
| `User` | name, login?, passwordHash?, pinHash?, role(ADMIN/CASHIER), status, **telegramId?** | Admin: login+parol. Kassir: PIN. `telegramId` — egani botga bog'lash (`OwnerLinkService`) |
| `Category` | name (unique) | |
| `Product` | sku, name, categoryId?, baseUnitLabel, **avgCost**, **stock**, lastLedgerSeq, isActive | `stock`/`avgCost` — KESH, ledger'dan hisoblanadi. `salePrice` YO'Q — narx `ProductUnit.price`da |
| `ProductUnit` | productId, label, factor, price, isBase, sortOrder | `price` — o'sha birlikdan BITTASINING narxi (baza narx × factor emas) |
| `Barcode` | code (unique), productId, isInternal | Bir tovarda ko'p barcode, unit'ga bog'lanmagan. Ichki EAN-13 prefiksi **`29`** — loyalty kartadan (`28`) farqlash uchun |
| `StockLedgerEntry` | seq(BigInt autoincrement), productId, type, qtyDelta, balanceAfter, unitCost, costDelta, avgCostAfter, refType/refId/refLineId | **Append-only**, hech kim UPDATE/DELETE qilmaydi |
| `Supplier` | name, contactPerson, phone | `contactPerson` admin'ning Yetkazib beruvchilar sahifasi uchun qo'shildi |
| `Receipt` / `ReceiptLine` | code(K-000001), status(DRAFT/POSTED/VOIDED), idempotencyKey; qtyInUnit/qtyBase, unitCostPack/unitCostBase | Kirim hujjati. POSTED bo'lganda `WaitlistService.notifyArrivals()` ham shu tranzaksiyada ishlaydi |
| `InventoryCount` / `InventoryCountLine` | code(INV-000001), status, totalDiffValue; expectedQty/countedQty/diffQty/unitCost/diffValue | Inventarizatsiya |
| `Shift` / `CashMovement` | openingCash/expectedCash/countedCash/diffCash; type(IN/OUT), amount, reason | Smena. `openedById` bo'yicha bitta foydalanuvchida bir vaqtda faqat bitta OPEN smena. `openingCash=0` **to'g'ri holat**, POS UI shuni bloklamasligi kerak |
| `Sale` / `SaleLine` / `SaleTender` | code(#4821), idempotencyKey(unique, majburiy); qtyBase, **unitCostBase (snapshot)**, lineCost, returnedQtyBase; type(CASH/CARD/CLICK/CREDIT); **loyaltyPointsEarned, loyaltyPointsRedeemed, loyaltyDiscount** | Sotuv. `unitCostBase` sotuv payhtidagi avgCost — keyin o'zgarmaydi |
| `SaleReturn` / `SaleReturnLine` | code(Q-000001), refundTotal, refundTender(bitta usul), costReversed; qtyBase, refundAmount, unitCostBase(original snapshot) | Qaytarish |
| `Customer` / `CustomerDebtEntry` | debtBalance(kesh); seq(BigInt), type(CREDIT_SALE/PAYMENT/RETURN_CREDIT/ADJUSTMENT), amount(**signed**), balanceAfter; **cardCode?, pointsBalance, telegramId?, telegramUsername?** | Nasiya — qoldiq/tannarx bilan bir xil ledger pattern. `cardCode` — EAN-13, `28` prefiks |
| `LoyaltyEntry` | seq(BigInt), customerId, type(EARN/REDEEM/ADJUSTMENT/RETURN_REVERSAL), points(**signed**), balanceAfter, refType/refId | `CustomerDebtEntry`ning ball-tomondagi egizagi, xuddi shu ledger pattern |
| `ProductRequest` | customerId?, productId?, rawText?, phone?, status(OPEN/NOTIFIED/CLOSED), source(BOT/POS/ADMIN) | Waitlist — "tovar kelganda xabar ber" |
| `NotificationOutbox` | kind, payload(Json), targetType(CUSTOMER/OWNER), targetTelegramId?, status(PENDING/SENT/FAILED), attempts | Durable navbat — `OutboxPoller` @Interval bilan poll qiladi, 3 urinishdan keyin FAILED |
| `AuditLog` | action, entity, entityId?, detail(Json), userId?, ip? | |
| `Settings` | id=1 (singleton), allowNegativeStock, roundingMode, lastClosedPeriodAt, **loyaltyEnabled, loyaltyEarnPoints, loyaltyEarnPerSum, loyaltyPointValue, loyaltyMinRedeemPoints, loyaltyMaxRedeemPercent(≤100)** | |
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
`CustomerDebtEntry.refType+refId`/`.occurredAt`),
`20260912234244_add_supplier_contact_person`,
`20260922000000_discount_sum_based` (chegirma foizdan summaga),
`20260922112003_loyalty_core` (`LoyaltyEntry`, `Customer.cardCode/
pointsBalance/telegramId/telegramUsername`, `Sale.loyaltyPoints*`,
`Settings.loyalty*`), `20260922115901_owner_telegram_link`
(`User.telegramId`), `20260922124740_waitlist_and_outbox`
(`ProductRequest`, `NotificationOutbox`). Barchasi qo'lda yozilgan SQL
(`npx prisma migrate diff --from-config-datasource ... --script` bilan
generatsiya qilingan — muhit non-interaktiv bo'lgani uchun oddiy
`migrate dev` ishlamaydi, `migrate deploy` bilan qo'llanadi).

**Seed** (`apps/api/prisma/seed.ts`): kategoriyalar + birinchi ADMIN.
Admin login/parol **hardcode ham, `.env`dan ham EMAS** — faqat CLI
argument: `tsx prisma/seed.ts --admin-login=admin --admin-password=...`
(`prisma db seed` orqali: `prisma db seed -- --admin-login=... --admin-
password=...`). Argument berilmasa aniq xato bilan `exit 1`. Qayta ishga
tushirilsa (login bir xil) parolni **yangilaydi** — shu bilan birga
parolni unutib qo'yilganda tiklash vositasi ham bo'ladi. Demo kassir
(PIN `1234`, e2e testlar shunga tayanadi) o'zgarishsiz qoldi — bu ishlab
chiqarish credential'i emas, test fixture'i.

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
- **Loyalty**: `dto.redeemPoints` bo'lsa — `maxRedeemablePoints()` bilan
  tekshiriladi (balans, `loyaltyMaxRedeemPercent` chegirmadan keyingi
  summadan, `loyaltyMinRedeemPoints` pastki chegara), `REDEEM` yozuvi
  yoziladi, `total` shu summaga kamayadi. Ball **qolgan (haqiqiy to'langan)**
  summadan hisoblanadi — `EARN` hisob-kitobi `redeemPoints`dan KEYINGI
  `total`ga tayanadi. `voidSale()` — to'liq bekor qilishda ishlatilgan
  ballni `ADJUSTMENT` bilan to'liq qaytaradi (ishlab topilganini
  `RETURN_REVERSAL` bilan qaytarib olgani kabi).

### `ReturnsService` (`modules/returns/returns.service.ts`)

`POST /returns`, `@RequiresPinConfirmation()`. Qaytarish miqdori
`SaleLine.qtyBase − returnedQtyBase`dan oshmasa (409 aks holda).
`applyMovement(type:RETURN, unitCost: saleLine.unitCostBase)` — original
snapshot narxda. `refund.util.ts`dagi `computeRefund()` — qatorning
qaytariladigan qismini proporsional hisoblaydi, sotuv darajasidagi umumiy
chegirmani (**+ loyalty chegirmasini, `saleLoyaltyDiscount` parametri** —
ikkalasi ham xuddi shu tarzda pulni kamaytiradi) ustiga qo'llaydi
(`roundingAdj`ga QASDAN tegilmaydi — bir martalik tiyin tuzatishi
qaytarishlarga bo'linib ketmasin uchun). Loyalty: `sale.loyaltyPointsEarned`
proporsional `RETURN_REVERSAL` bilan qaytarib olinadi, `sale.
loyaltyPointsRedeemed` esa proporsional `ADJUSTMENT` bilan mijozga qaytarib
beriladi (`proportionalPointsReversal()` — ikkalasida ham bir xil formula).

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
- `demand(days)` — `deadStock()`ning teskarisi: `ProductRequest.groupBy(
  ['productId'])` + qoldig'i `<=0` bo'lgan tovarlar, so'ralgan soni bo'yicha
  saralangan. `/reports/demand`, admin `/reports` sahifasida "Talab
  qilingan" tabi.

### `LoyaltyService` (`modules/loyalty/loyalty.service.ts`)

`CustomerDebtService`ning ball-tomondagi egizagi — `Customer.pointsBalance`ga
yozadigan **yagona** joy, xuddi shu `FOR UPDATE` lock + signed
`points`/`balanceAfter` pattern. `LoyaltyEntry.type`: `EARN`/`REDEEM`/
`RETURN_REVERSAL` — magnitude sifatida beriladi, `write()` ichida to'g'ri
ishora qo'llanadi (`REDEEM`/`RETURN_REVERSAL` → manfiy); `ADJUSTMENT` —
chaqiruvchi ishorani o'zi beradi (masalan qaytarishda ball qaytarish uchun
musbat qiymat bilan chaqiriladi).

- `ensureCard(customerId)` — mavjud bo'lmasa `28`-prefiksli EAN-13 karta
  generatsiya qiladi (`loyalty-card.util.ts`, `catalog/barcode.util.ts`dagi
  checksum funksiyasini qayta ishlatadi; P2002'da 5 marta qayta urinadi —
  `ProductsService.generateBarcode()` bilan bir xil pattern).
- `loyalty.util.ts` (sof funksiyalar, DB'siz, to'liq unit-testlangan):
  `computeEarnedPoints`, `computeRedeemValue`, `maxRedeemablePoints`,
  `proportionalPointsReversal`.
- POS'da mijoz biriktirish: **`PaymentScreen.tsx`**da (avval `SaleScreen`da
  edi, keyin ko'chirildi — ball bilan to'lash shu sahifada bo'lgani uchun
  mantiqiyroq). Karta kodi (`28...`) skaner yoki qo'lda kiritish maydoniga
  tushadi, `GET /customers/by-card/:code` chaqiriladi. `SaleScreen`da faqat
  tovar barcode qidiruvi (`29...` yoki umuman internal bo'lmagan) qoladi.

### Waitlist (`modules/waitlist/`) + Notification outbox

`WaitlistService.create()` — `ProductRequest` yozadi (customerId yoki
rawText, kamida bittasi kerak). `notifyArrivals(tx, productIds, receiptId)`
— **`ReceiptsService.post()` bilan bitta tranzaksiyada** chaqiriladi: mos
`OPEN` so'rovlarni topib, mijozning `telegramId`si bo'lsa
`NotificationOutbox` yozuvi yaratadi (`kind:'product_arrived'`), barcha
mos so'rovlarni `NOTIFIED` qiladi (telegramId bo'lmasa ham — demand
hisobotida ochiq qolib ketmasligi uchun). `POST /product-requests` —
kassir uchun (POS'da qidiruv natija bermasa "Mijoz so'radi" tugmasi).

### `OwnerLinkService` (`modules/owner-link/owner-link.service.ts`)

Xotirada saqlanadigan 6 xonali bir martalik kod (10 daqiqa TTL) — admin
panelning "Telegram'ga ulash" tugmasi (`POST /users/me/telegram-link-code`)
kodni beradi, bot `/link <kod>` bilan `User.telegramId`ni bog'laydi.
Restart kodlarni yo'qotadi — muammo emas, qisqa muddatli oqim.

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

## Telegram bot + AI agent (`apps/api/src/modules/telegram-bot/` va `modules/bot/`)

**Muhim arxitektura qarori**: bot dastlab alohida `apps/bot` ilovasi
sifatida qilingan edi (NestJS + grammY, `ApiClient` orqali HTTP + shared
`X-Service-Key`). Keyinroq **API process'iga birlashtirildi** — bitta
do'kon uchun ikkita servisni saqlashning ma'nosi yo'q edi, HTTP hop faqat
kechikish va ikkinchi auth chegarasi (`ServiceKeyGuard`, endi o'chirilgan)
qo'shardi. Endi:

- `modules/bot/bot.service.ts` — **butun biznes mantiq** shu yerda: mijoz
  register/loyalty/debt/purchases, egani link qilish, tovar qidirish,
  hisobot proksilari, waitlist, outbox. Oddiy Nest servis, HTTP controller
  YO'Q — hech kim tashqaridan chaqirmaydi.
- `modules/telegram-bot/` — grammY `Bot` instansi (`bot.provider.ts`),
  webhook (`webhook.controller.ts`, `@Public()`, `POST /api/telegram/
  webhook`, grammY o'zi `X-Telegram-Bot-Api-Secret-Token`ni tekshiradi),
  `SessionService` (chatId → {role, id} kesh, miss bo'lsa `BotService`dan),
  oqimlar (`flows/`) va AI agent (`agent/`) — hammasi `BotService`ni
  **to'g'ridan-to'g'ri** chaqiradi, HTTP yo'q.
- `TelegramBootstrapService.onModuleInit()` — oqimlarni ro'yxatga oladi,
  `bot.api.setWebhook()` chaqiradi. **`NODE_ENV==='test'` bo'lsa bu tarmoq
  chaqiruvi o'tkazib yuboriladi** — aks holda har bir e2e test AppModule
  ko'targanda haqiqiy Telegram API'ga so'rov ketardi.
- Oqimlar ro'yxatga olinish tartibi muhim (grammY birinchi mos kelgan
  handler'da to'xtaydi): `start` → `menu` → `card` → `ownerLink` → `agent`
  (oxirgi, erkin matn uchun — hech biriga mos kelmasa AI'ga boradi).

### AI agent (`agent/agent.service.ts`)

DeepSeek (`deepseek-chat`, `openai` SDK, faqat `baseURL` boshqa — factory
provider `deepseek.provider.ts` orqali, testda soxta client bilan
almashtiriladi). Tool-calling sikli: maks 5 iteratsiya, 30s timeout, 10
so'rov/daqiqa rate-limit (sessiya kaliti bo'yicha), 30 daqiqalik kontekst
xotirasi (oxirgi 6 xabar).

- `tools/customer.tools.ts` — faqat o'qish + `request_product` (yagona
  yozuvchi tool, waitlist'ga yozadi).
- `tools/owner.tools.ts` — sotuv xulosasi, top tovarlar, kam qolgan/
  tugagan, harakatsiz tovar, foyda, ochiq smenalar, talab hisoboti.
  Hammasi `BotService` orqali `ReportsService`/`ProductsService`ga
  proksi — hech biri narx/sotuv/qoldiqni o'zgartirmaydi.
- **Telegram HTML formatlash**: javob `parse_mode:'HTML'` bilan
  yuboriladi (`flows/agent.flow.ts`), parse xatosi bo'lsa oddiy matnga
  qaytadi (`try/catch`). System prompt'da aniq ko'rsatma bor: Markdown
  EMAS, faqat `<b>`/`<i>`/`<code>`/`<a href>`, ro'yxat/jadval teglari
  ishlamaydi (qo'lda "• " bilan), oddiy `<`/`>`/`&` belgilarini matnda
  ishlatmaslik kerak (aks holda Telegram xabarni rad etadi).

### Outbox poller (`notifications/outbox.poller.ts`)

`@Interval(15000)` (`@nestjs/schedule`, `ScheduleModule.forRoot()`
`app.module.ts`da) — `BotService.listOutbox()`/`ackOutbox()`ni
to'g'ridan-to'g'ri chaqiradi, xabarni bot instansi (`GRAMMY_BOT` orqali,
`TelegramBotModule`dan eksport qilingan) bilan yuboradi. 3 marta
muvaffaqiyatsizlikdan keyin yozuv `FAILED` bo'ladi.

### Sozlamalar (`.env`)

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `PUBLIC_URL` (API'ning
o'zi ochiq turgan HTTPS manzili — webhook shu + `/api/telegram/webhook`
ga o'rnatiladi), `DEEPSEEK_API_KEY`. `SERVICE_API_KEY` **endi kerak
emas** (o'chirilgan).

Egasi botga qanday bog'lanadi: admin `/settings` sahifasida "Telegram'ga
ulash" tugmasi (`TelegramLinkButton` komponenti) 6 xonali kod beradi,
egasi botga `/link <kod>` yuboradi (`OwnerLinkService`).

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

## Testlar (41 unit + 56 e2e, hammasi o'tadi)

**Unit** (41 test, DB'siz, `pnpm --filter @barakasell/api test`):
- `modules/inventory/costing.util.spec.ts` (8) — moving average formulasi.
- `modules/settings/rounding.util.spec.ts` (5) — NONE/R10/R100/R1000,
  yaxlitlash yo'nalishi, aniq qiymat.
- `modules/returns/refund.util.spec.ts` (8) — to'liq/qisman qaytarish,
  sotuv darajasidagi chegirma proratsiyasi, tiyin darajasida yaxlitlash,
  **loyalty chegirmasi flat chegirma bilan bir xil tarzda ayirilishi**.
- `modules/loyalty/loyalty.util.spec.ts` (11) — ball hisoblash, redeem
  qiymati, `maxRedeemablePoints` chegaralari, proporsional qaytarish.
- `modules/telegram-bot/flows/flows.spec.ts` (5) — `/start` oqimi (soxta
  `Bot`+`BotService` bilan, tarmoqsiz), menyu tugmalari.
- `modules/telegram-bot/agent/agent.service.spec.ts` (4) — tool-calling
  sikli, iteratsiya chegarasi, rate-limit (soxta OpenAI client bilan).

**E2E** (56 test, `apps/api/test/*.e2e-spec.ts`, real Postgres kerak):

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
| `sale-void.e2e-spec.ts` | TOTP'siz 403, muvaffaqiyatli void → stock qaytishi, qayta void 409 |
| `returns.e2e-spec.ts` | PIN'siz 403, qisman qaytarish original snapshot narxda, ortiqcha qaytarish 409 |
| `credit.e2e-spec.ts` | Nasiya sotuv qarzni oshiradi, to'lov kamaytiradi (`balanceAfter` ketma-ketligi), naqd to'lov smena `expectedCash`iga tushishi, mijozsiz CREDIT tender 400 |
| `reports.e2e-spec.ts` | `/reports/dashboard` shakli, `/reports/dead-stock` sotilmagan tovarni topishi, `/reports/stock-value` shakli o'zgarmaganligi (regression) |
| `suppliers.e2e-spec.ts` | `contactPerson` saqlanishi, `totalPurchase` faqat POSTED kirimlardan hisoblanishi (qoralama hisobga kirmasligi) |
| `loyalty.e2e-spec.ts` | Ball qo'shilishi/o'chirilgan holatda qo'shilmasligi, qaytarishda proporsional qaytishi, karta generatsiyasi/lookup, **redeem: to'lash+topish birga, balansdan oshirib bo'lmasligi, mijozsiz rad etilishi, qaytarishda proporsional ball qaytishi** |
| `bot-service.e2e-spec.ts` | `BotService`ni to'g'ridan-to'g'ri chaqirib (HTTP'siz): register idempotentligi, telefon bo'yicha mavjud mijozga bog'lanishi, owner-link kodi bir martalik ekanligi, tovar qidirish |
| `product-requests.e2e-spec.ts` | Waitlist so'rovi → mos kirim → outbox to'ldirilishi, boshqa tovarga tegmasligi, telegramId yo'q mijozda outbox yozilmasligi, talab hisobotida ko'rinishi |

Ishga tushirish: `pnpm --filter @barakasell/api test` (unit),
`pnpm --filter @barakasell/api test:e2e` (integratsiya, Postgres kerak:
`docker compose up -d db`). **Eslatma**: agar dev bazadagi admin paroli
`admin`/`admin123`dan boshqa narsaga o'zgartirilgan bo'lsa (haqiqiy
foydalanish uchun), e2e fixture mos kelmay qoladi — shunday holatda
vaqtinchalik alohida Postgres konteynerida (`docker run ... postgres:16-
alpine` + `prisma migrate deploy`) sinash kerak, asosiy dev bazaga
tegilmaydi.

---

## Admin UI

**1-milestone**: `/login`, `/products` (ro'yxat+filtr+yangi tovar modal + sahifalash/pagination: `page`, `limit`, `total`, oldingi/keyingi va qator sonini tanlash),
`/products/[id]` (birliklar, barcode, harakat tarixi), `/receipts`
(ro'yxat), `/receipts/[id]` (`id==="new"` — yaratish rejimi ham shu sahifada).

**Sotuv oqimiga oid 6 sahifa** (endi tayyor, brauzerda tasdiqlangan):
- `/dashboard` — 4 KPI karta (`CornerMarks` birinchi marta ishlatildi),
  top sotilgan/kam qolgan ro'yxatlari, oxirgi smenalar jadvali. Bitta
  `GET /reports/dashboard` chaqiruvi. Login'dan keyingi va bosh `/`
  redirect endi shu sahifaga (`/products`dan o'zgardi).
- `/customers` — master/detail mijozlar+nasiya, POS'dagi bilan **bir xil**
  `Customer`/`CustomerDebtEntry` ma'lumotiga ulanadi (POS'da yaratilgan
  qarz shu yerda ko'rinadi — qo'lda tasdiqlangan). **Loyalty**: ball
  balansi kartasi, karta kodi (yo'q bo'lsa "Karta yaratish" tugmasi —
  `POST /customers/:id/loyalty/card`).
- `/reports` — 5 tab (Qoldiq/Foyda-zarar/Smenalar/Harakatsiz/**Talab
  qilingan**), bitta sahifa ichida segment almashtirish (alohida route
  emas). "Talab qilingan" — `GET /reports/demand`, xarid rejasi uchun.
- `/audit` — filtrlanadigan audit jurnali, amal-nomiga qarab rangli tag.
- `/users` — foydalanuvchilar, "+ Yangi", holat almashtirish, **PIN
  tiklash** (`POST /auth/confirm-pin` → `X-Pin-Confirmation` header bilan
  `PATCH /:id/pin` — ikki bosqichli modal, uchdan-uchiga brauzerda
  tasdiqlangan).
- `/settings` — `allowNegativeStock` toggle, `roundingMode` radio,
  **Loyalty bloki** (yoqish/o'chirish + 5 qoida maydoni: earn/redeem
  qoidalari), **"Telegram bot" bloki** (`TelegramLinkButton` — "Telegram'ga
  ulash" tugmasi, `POST /users/me/telegram-link-code`, 6 xonali kod
  ko'rsatadi), "Davrni yopish" **ataylab disabled** (bu maydonni yozadigan
  endpoint yo'q — yangi biznes-qoida, keyingi bosqich).
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

### Loyalty + waitlist qo'shimchalari (3-milestone)

- **Mijoz kartasini biriktirish** `PaymentScreen.tsx`da: skaner/qo'lda
  kiritish maydoni ("Biriktirish" tugmasi bilan, Enter ham ishlaydi),
  `GET /customers/by-card/:code`. `SaleScreen.tsx`da endi FAQAT tovar
  barcode qidiruvi qoladi (loyalty kod tekshiruvi olib tashlandi — bitta
  joyda, to'lov sahifasida, chunki ball bilan to'lash ham shu yerda).
- **Ball bilan to'lash** — "Ball bilan to'lash" tugmasi (faqat
  `maxRedeemPoints>0` bo'lganda ko'rinadi — server formulasi client'da
  ham qayta hisoblanadi, aniq son server tomonidan tasdiqlanadi),
  raqamli klaviatura orqali ball kiritiladi, `total` shunga mos kamayadi.
  **PIN talab qilinmaydi** — mavjud "Chegirma" tugmasi bilan bir xil UX
  (u ham PIN so'ramaydi).
- **"Mijoz so'radi"** — `SaleScreen`da qidiruv natija bermasa chiqadigan
  tugma, telefon (ixtiyoriy) + tovar nomi bilan `POST /product-requests`
  yozadi.
- **Bugfix**: `ShiftOpenScreen.tsx`da "Smenani boshlash" tugmasi
  `value <= 0` bo'lsa disabled edi — 0 so'm bilan smena ochish **to'g'ri
  holat** (backend `Min(0)` ruxsat beradi), endi faqat `busy`da disabled.

Ishga tushirish: `pnpm --filter @barakasell/pos dev` (portu 5173),
`pnpm --filter @barakasell/pos build` (tsc+vite+PWA generatsiya).

---

## Keyingi qadamlar

### 1. Egasi uchun hodisaviy/vaqtli bildirishnomalar (ataylab hali qilinmagan)

3-milestone rejasining "Bosqich 5"i — hozir faqat so'rov-javob AI va
waitlist ("tovar keldi") xabarlari ishlaydi. Qolgani:

- **Hodisaviy** (API, tranzaksiya ichida `NotificationOutbox`ga yozish):
  smena ochilgan/yopilgan (tushum+farq), kassa farqi ostonadan katta
  (yangi `Settings.cashDiffAlertAmount`), sotuv bekor qilindi.
- **Vaqtli** (bot tomonida `@Cron`, `@nestjs/schedule` allaqachon
  ulangan — `outbox.poller.ts`dagi kabi): kunlik xulosa, kam qolgan
  tovarlar + eski `OPEN` so'rovlar, haftalik foyda.
- Kimga: `User.telegramId` bog'langan ADMIN'lar (`OwnerLinkService`
  allaqachon tayyor).

### 2. Excel import

`ImportJob`/`ImportRow` jadvallari schema'da bor, kod yo'q.
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

### 3. AI bilan kirim (chek/faktura) OCR

Boshida muhokama qilingan, ataylab keyingi milestone'ga qoldirilgan:
chek/накладной rasmini Vision model bilan o'qib, `Receipt` draft'ini
avtomatik to'ldirish, fuzzy SKU moslashtirish, narx anomaliyasi
ogohlantirishi. Hozircha kod yo'q.
