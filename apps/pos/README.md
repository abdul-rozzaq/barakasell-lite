# @barakasell/pos

Kassa (POS) — Vite + React 19 + Tailwind v4 PWA, Android planshetda ishlash
uchun mo'ljallangan. Offline savat+navbat (`idb`), barcha 10 ekran holati:
[`../../PROGRESS.md`](../../PROGRESS.md).

## Ishga tushirish

```bash
pnpm --filter @barakasell/pos dev     # http://localhost:5173
pnpm --filter @barakasell/pos build   # tsc + vite + PWA generatsiya
```

Router yo'q — bitta `AppContext` (`useReducer`) ekranlarni almashtiradi.
Backend manzili `.env`dagi `VITE_API_URL`.
