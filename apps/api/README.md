# @barakasell/api

NestJS + Prisma + PostgreSQL backend: ombor, sotuv, hisobot, loyalty,
Telegram bot va AI agent (barchasi bitta process ichida). To'liq arxitektura
va model tavsifi: [`../../PROGRESS.md`](../../PROGRESS.md). Biznes qoidalar
spec'i: [`../../plan/plan.md`](../../plan/plan.md).

## Sozlash

```bash
pnpm install
docker compose up -d db          # Postgres 16, port 5434 (root docker-compose.yml)
pnpm --filter @barakasell/api prisma migrate deploy
pnpm --filter @barakasell/api exec tsx prisma/seed.ts --admin-login=admin --admin-password=...
```

## Ishga tushirish

```bash
pnpm --filter @barakasell/api start:dev   # watch mode
pnpm --filter @barakasell/api build
pnpm --filter @barakasell/api start:prod
```

## Testlar

```bash
pnpm --filter @barakasell/api test        # unit (DB'siz)
pnpm --filter @barakasell/api test:e2e    # e2e (real Postgres kerak)
```

## `.env`

`DATABASE_URL`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`PUBLIC_URL`, `DEEPSEEK_API_KEY`.
