# syntax=docker/dockerfile:1

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app

# `output: "standalone"` (next.config.ts) already prunes node_modules down
# to exactly what server.js needs.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["node", "server.js"]
