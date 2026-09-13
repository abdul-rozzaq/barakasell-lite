# syntax=docker/dockerfile:1

FROM node:24-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

# -s: SPA fallback — unknown paths serve index.html instead of 404.
CMD ["serve", "-s", "dist", "-l", "3000"]
