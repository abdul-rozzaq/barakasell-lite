# Handoff: BarakaSELL Lite — POS (Kassa) & Admin

## Overview
Savdo va ombor tizimi: bitta do'kon, bitta ombor. Ikki mahsulot, bitta design system:
- **Kassa (POS)** — Android planshetda ishlaydigan PWA, sotuvchi uchun, touch-first, tezlikka mo'ljallangan.
- **Admin** — desktop brauzerda ishlaydigan panel, do'kon egasi uchun, data-first (jadvallar, filtrlar, hisobotlar).

Chek chiqarilmaydi (print funksiyasi yo'q). Ko'p do'kon/ombor, transfer, loyalty, maosh — bu doiraga kirmaydi.

## About the Design Files
Files in this bundle (`Kassa.dc.html`, `Admin.dc.html`) are **design references built as self-contained interactive HTML prototypes** — they show the intended look, layout, and click-through behavior, not production code to copy verbatim. Your task is to **recreate these designs in the target codebase's environment** (React, Flutter, native Android, etc. — whichever the project already uses, or the best-fit framework if none exists yet), following its existing state-management, navigation and component patterns.

Both files use only **inline styles** (no CSS classes/stylesheet) because they were authored in a live-streaming prototyping tool — do not carry that constraint into the real app; use your codebase's normal styling approach (styled-components, Tailwind, SwiftUI modifiers, etc.) while matching the exact values below.

## Fidelity
**High-fidelity.** Colors, type, spacing and states below are final — implement pixel-close using your codebase's own component/styling primitives.

## Design Tokens

**Colors** (light, cool-neutral "blueprint/industrial" palette):
- Background: `#f2f2f3`
- Surface (cards, inputs, panels): `#e9e9ea` / sidebar `#e7e7ea`
- Text (primary): `#1d1f20`
- Text muted: `rgba(29,31,32,0.55)` / `0.6` / `0.7`
- Divider / border: `rgba(29,31,32,0.16)`
- Accent (primary actions, links, focus): `#5980a6`
- Accent dark (headings-on-tint, pressed): `#416180`
- Accent tint (badges): `#eef6ff` bg / `#2c455d` text, or `#d6ebff` bg / `#416180` text
- Success/positive: `#2c6b3f` text, `#8fbf9e` border
- Warning (low stock, drafts): `#7a5a12` text, `#d1a94a` border, `#f3e3c4` fill
- Error/danger (out of stock, delete, returns, negative diff): `#a23b2e` text, `#c98f80` border, `#f3ded9` fill

**Typography:**
- Headings, buttons, numbers/prices: **Barlow Condensed**, weight 600–700
- Body text, inputs, table cells: **Barlow**, weight 400–500
- Google Fonts: `Barlow:wght@400;500;700` and `Barlow+Condensed:wght@500;600;700`

**Shape:** square corners everywhere (`border-radius: 0`) — this is a deliberate "blueprint/wireframe" aesthetic. Primary CTAs, the payment/PIN dialogs, and dashboard KPI cards carry small "+" crosshair registration marks at each of their 4 corners (11×11px, two 1px bars, `rgba(29,31,32,0.55)`) — decorative chrome only, skip if your design system doesn't support it.

**Spacing:** roughly an 8–16px rhythm; buttons/inputs default to 44–56px tall (touch targets) in Kassa, 36–46px in Admin.

**Currency formatting:** so'm, no decimals/tiyin. Group thousands with a space: `128 000 so'm` (not commas). Uzbek Latin copy throughout.

## Files
- `Kassa.dc.html` — POS prototype, all 10 screens/states, single file, internal state machine (no routing).
- `Admin.dc.html` — Admin prototype, all 13 screens/states, single file, sidebar-driven internal state machine.

Both are plain HTML/inline-JS you can open directly in a browser to click through every flow and state. A small gray "Prototip boshqaruvi" toolbar at the top of each (outside the actual product frame) has dev-only toggles (orientation, offline simulation, role switch, list states) — **not part of the product design**, only there to reach hard-to-trigger states for review.

---

## KASSA (POS) — Screens

Internal `state.screen` values drive navigation (see `renderVals()` / `state` in `Kassa.dc.html`'s script for the exact state shape).

### 1. Kirish (Login) — `screen:"login"`
- Grid of cashier tiles (avatar circle with initial + name). Tap → PIN entry section for that cashier (back link, 4 pin-dots, 3×4 numeric keypad `1-9,.,0,⌫`).
- 4 correct digits → advance; wrong PIN shows red "Noto'g'ri PIN kod" text, clears after ~450ms.
- Data: 2 seed cashiers, `pin` 4-digit each.

### 2. Smena ochish (Shift open) — `screen:"shiftOpen"`
- Big amount display + same numeric keypad, entering **opening cash**.
- "Smenani boshlash" primary button (disabled until amount > 0) → goes to Sale screen, `shiftOpen=true`.

### 3. Sotuv ekrani (Sale) — `screen:"sale"` — the core screen
- **Header** (44px): hamburger (opens drawer) · brand · offline pill (amber, shows pending-sync count) if offline · cashier name.
- **Stock notice banner** (dismissible, red-tinted): shown after adding an out-of-stock item — "sotuv davom etadi" even with 0 stock.
- **Body**, flex row (landscape) / column (portrait):
  - Left/main: search input (barcode scanner types into it directly — plain text input, no special handling needed) → category chip row (horizontal scroll, "Hammasi" + 5 categories) → product grid (`auto-fill, minmax(140px,1fr)`), tiles show name, optional stock tag ("Kam qoldi" amber / "Tugagan · sotiladi" red outline), price. Multi-unit products (e.g. dona/pachka/karobka) open a bottom-sheet unit picker on tap; single-unit products add directly.
  - Right: cart panel (380px landscape / full width bottom in portrait) — rows with name, unit label, qty stepper (−/qty/+, tapping the qty number opens a numeric-pad modal for exact entry), row "%" discount button (PIN-gated), delete "✕" (PIN-gated). Footer: subtotal, optional overall-discount line (PIN-gated, %), big JAMI total, full-width "TO'LOV" primary button.
- **Keyboard-open simulation**: focusing the search input shows a gray bottom overlay covering ~44% of the screen labeled "EKRAN KLAVIATURASI" and shrinks the product grid's usable area — this models the real on-screen-keyboard-eats-half-the-screen problem; implement with your platform's real keyboard-avoidance instead.
- **Drawer** (hamburger menu): Bugungi sotuvlar, Qaytarish, Kassa harakati, Nasiya mijozlari, Smenani yopish.
- **Reusable numeric-pad modal**: used for cart qty, row/overall discount %, and (on the Payment screen) tender amounts. Title changes by mode; confirm/cancel buttons.
- **PIN reconfirmation modal**: identical small dialog (with corner marks) used before: deleting a cart row, applying a row/overall discount, confirming a return, confirming a cash movement. Generic — action + payload determine what happens on success.

### 4. To'lov (Payment) — `screen:"payment"`
- Left: summary card (item count + total, corner marks).
- Right: segmented toggle **Aralash to'lov** vs **Nasiya**.
  - Aralash: 3 tender rows (Naqd / Karta / Click), each opens the numeric pad; shows to'langan / qolgan (if under) / qaytim (if cash overpays).
  - Nasiya: customer search + list (name, phone, current debt highlighted red); shows "yangi qarz" preview once selected.
- "Sotuvni yakunlash" primary button, disabled until paid ≥ total (or a credit customer is picked).

### 5. Sotuv yakuni (Sale complete) — `screen:"saleComplete"`
- Centered card (corner marks): checkmark glyph, big sale code (`#4821`-style, incrementing), amount, method line. **No print/receipt button anywhere** — explicitly excluded from scope. "Yangi sotuv" primary button + "Bugungi sotuvlarni ko'rish" link.

### 6. Bugungi sotuvlar (Today's sales) — `screen:"salesToday"`
- List of today's sales (code, time, method tag, total); tap row expands inline to show line items + a "Qaytarish" button (jumps to Returns pre-loaded with that sale) — **this is the substitute for a printed receipt**.
- States: loading (pulsing skeleton bars), empty ("Hali sotuvlar yo'q"), error (message + retry), ok.

### 7. Qaytarish (Returns) — `screen:"returns"`
- Search sale by code, or arrive pre-selected from Today's Sales. Selected sale shows each line item with a qty-return stepper (max = originally sold qty), computed refund total. "Qaytarishni tasdiqlash" → PIN modal → toast confirmation, returns to Sale.

### 8. Kassa harakati (Cash movement) — `screen:"cashMovement"`
- Segmented **Pul olib chiqish** (inkassatsiya) / **Pul kiritish**, amount via numeric pad, free-text reason, PIN-gated confirm. Running list of today's movements below (signed amounts, colored).

### 9. Smenani yopish (Shift close) — `screen:"shiftClose"`
- **Kutilgan naqd** (computed: opening cash + session cash sales − cash-out + cash-in, read-only).
- **Sanalgan naqd** (numeric pad input — what the cashier physically counted).
- **Farq** (counted − expected; red if short, amber if over, green if exact).
- "Smenani yopish" → ends session, returns to Login.

### 10. Nasiya mijozlari (Credit customers) — `screen:"creditCustomers"`
- Master list (name + debt, search) / detail panel (name, phone, current debt, "To'lov qabul qilish" → numeric pad → reduces balance, debt history list).

### Cross-cutting Kassa states
- Offline: toolbar-toggleable; shows an amber "OFFLINE · N ta yuborilmadi" pill in the Sale header; count increments per sale completed while offline.
- Portrait/landscape: whole frame reflows (`flex-direction` swap, cart panel goes from a fixed side column to a stacked section).
- "Savat tiklandi" toast: models the "tablet slept, cart persisted" requirement — on a real device, back this with persisted local storage/DB, not just in-memory state.

---

## ADMIN — Screens

Internal `state.screen` + a persistent left sidebar (`Admin.dc.html`).

### 11. Dashboard — `screen:"dashboard"`
- 4 KPI cards (corner marks): bugungi tushum, bugungi foyda, naqd farqi (colored by sign), ochiq smenalar.
- Two side-by-side lists: top sotilgan tovarlar, qoldig'i tugayotgan tovarlar (red qty).
- Oxirgi smenalar table (sana, kassir, tushum, naqd farqi).

### 12. Tovarlar ro'yxati (Products list) — `screen:"products"`
- Search + category `<select>` + 3-way stock segmented filter (Hammasi/Kam qoldi/Tugagan).
- Table: Nomi, Kategoriya, Qoldiq, Sotuv narxi, Tannarx, Holat tag (Yetarli green / Kam qoldi amber / Tugagan red). Row click → detail. Footer shows "X tadan 1–N ko'rsatilmoqda" (real data: ~5000 rows — mock shows a representative sample; implement real pagination/virtualization).
- States: loading (skeletons), empty, error (+ retry), ok.

### 13. Tovar kartochkasi (Product detail) — `screen:"productDetail"`
- O'lchov birliklari table (unit label, conversion factor, price) — e.g. dona / pachka (50 dona) / karobka (10 pachka · 500 dona).
- Shtrix-kodlar as chips (a product can have several barcodes).
- Qoldiq, o'rtacha tannarx, sotuv narxi as stat blocks.
- Harakatlar tarixi table (sana, turi tag [Kirim/Sotuv/Qaytarish/Inventarizatsiya], miqdor signed+colored, qoldiq keyin).

### 14. Excel'dan import — `screen:"excelImport"`
- 3-step: idle (dropzone + file picker) → ready (mapping table source-col→target-field, preview table with per-row OK/Xato tags, error-count summary, "Tasdiqlash va import qilish") → done (success message). Real implementation needs actual parsing, column-mapping UI, and server-side validation for up to 5000 rows.

### 15/16. Kirim hujjati + Kirimlar ro'yxati — `screen:"incomingDoc"` / `"incomingList"`
- List: table of documents (sana, yetkazib beruvchi, jami, Holat tag Tasdiqlangan/Qoralama), "+ Yangi hujjat", row click → detail.
- Doc: supplier picker, line-items table (tovar, birlik/pack, miqdor, xarid narxi, jami), total, "Qoralama saqlash" (secondary) / "Tasdiqlash" (primary — locks the doc and should post to stock on the real backend).

### 17. Yetkazib beruvchilar — `screen:"suppliers"`
- Simple table: nomi, mas'ul shaxs, telefon, oxirgi kirim sanasi, jami xarid summasi.

### 18. Mijozlar va nasiya — `screen:"customers"`
- Master/detail like Kassa's credit-customer screen, admin side: list (name, debt) + detail (phone, current debt, to'lov tarixi). Wire this to the same customer records as Kassa's Nasiya mijozlari and Payment→Nasiya flow — one shared debt ledger.

### 19. Inventarizatsiya — `screen:"inventory"`
- Table: tovar, kutilgan qoldiq (read-only), sanalgan qoldiq (editable number input per row), farq (computed, colored). Footer: "Foydaga ta'siri" = Σ(diff × tannarx), colored by sign. "Tasdiqlash" should, on the real backend, write stock adjustments and a P&L entry.

### 20. Hisobotlar — `screen:"reports"`
Segmented tab switcher, 4 tabs sharing one screen:
- **Qoldiq hisoboti**: tovar, miqdor, tannarx summasi, sotuv narxi summasi.
- **Foyda-zarar**: secondary dimension toggle (Davr/Tovar/Kategoriya bo'yicha), rows of tushum/tannarx/foyda.
- **Smenalar**: same shift table as Dashboard, full list.
- **Harakatsiz tovarlar**: tovar, qoldiq, oxirgi sotuv sanasi (highlighted).

### 21. Audit log — `screen:"auditLog"`
- Table: vaqt, foydalanuvchi, amal (tag: Chegirma/O'chirish/Narx o'zgartirdi/Kirim tasdiqlandi/Qaytarish/Foydalanuvchi — each with its own tag color), tafsilot (free text). Every sensitive action gated by PIN in Kassa (discount, delete, return, cash movement) should write a row here on the real backend.

### 22. Foydalanuvchilar — `screen:"users"`
- Table: ism, rol (Admin/Kassir), PIN (masked "••••" in the mock — never render real PINs; add a reveal-once / reset-PIN action instead), holat (Faol/Bloklangan tag). Add-user action was scoped out of the mock; wire a real "+ Yangi foydalanuvchi" flow with PIN assignment.

### 23. Sozlamalar — `screen:"settings"`
- Toggle: manfiy qoldiqqa ruxsat (allow selling below zero stock).
- Radio group: summalarni yaxlitlash (yo'q / 10 / 100 / 1000 so'mgacha).
- "Davrni yopish" action + last-closed-period readout.

### No-permission state (cross-cutting)
- Toolbar "Rol: Kassir" toggle demonstrates: a kassir role hitting any Admin route sees a full-screen "Ruxsat yo'q" block instead of the panel. Enforce this server-side too, not just client-side routing.

---

## Interactions & Behavior notes
- All destructive/sensitive actions (delete cart row, apply discount, confirm return, confirm cash movement) require PIN reconfirmation via the same modal pattern — reuse one confirm-dialog component keyed by an "intent" enum in your implementation.
- Numeric entry never relies on the OS keyboard for money/qty fields — always a dedicated in-app numeric pad, sized for touch (Kassa) or a plain number input (Admin, mouse/keyboard use assumed).
- Offline queueing (Kassa) is only visually stubbed (a counter) — real implementation needs a local queue + background sync + conflict handling when the same barcode/stock changes offline vs. server.

## State Management (reference shape)
See the `state = {...}` block and `renderVals()` method inside each file's `<script>` for the full reactive shape already exercised by the prototype (screen enum, cart array, PIN/numpad modal state, filters, etc.) — use it as your data-model checklist, not as code to port directly.

## Assets
No external images/icons — everything is typographic (Barlow/Barlow Condensed) plus CSS-drawn shapes (circles, corner-mark crosshairs, a "✓"/"⛔" glyph). No brand logo asset was supplied; "BarakaSELL" renders as a wordmark in Barlow Condensed 700.
