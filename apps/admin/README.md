# @barakasell/admin

Next.js 16 admin panel — do'kon egasi uchun desktop panel. Loyiha holati va
sahifalar ro'yxati: [`../../PROGRESS.md`](../../PROGRESS.md). Tailwind CSS
kanonik qoidalari: [`./CLAUDE.md`](./CLAUDE.md).

## Ishga tushirish

```bash
pnpm --filter @barakasell/admin dev     # http://localhost:3000
pnpm --filter @barakasell/admin build
pnpm --filter @barakasell/admin lint
```

Stack: Next.js 16 (App Router), Tailwind CSS v4, JWT auth (`localStorage`,
httpOnly cookie emas). API bilan bog'lanish: `src/lib/api.ts` (fetch
wrapper), backend manzili `.env.local`dagi `NEXT_PUBLIC_API_URL`.
