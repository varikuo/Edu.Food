# Единый образ приложения: собранный фронт + API в одном процессе Node.
# node:sqlite встроен в Node 24 — нативных сборок и лишних зависимостей нет.
FROM node:24-alpine AS build
WORKDIR /app

# Сначала только манифесты — слой с зависимостями кешируется между сборками
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

# База и logins.csv лежат в DATA_DIR: на хостинге это точка монтирования тома,
# чтобы данные переживали перезапуск контейнера
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
