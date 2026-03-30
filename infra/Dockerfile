# 生产镜像：Next.js standalone + better-sqlite3（Linux x64）
# 需与 next.config.mjs 中 output: 'standalone' 一致
# 构建示例：
#   docker build -t yayanews:latest \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com \
#     --build-arg NEXT_PUBLIC_PARENT_SITE=https://www.biyapay.com \
#     --build-arg NEXT_PUBLIC_TRADING_SITE=https://invest.biyapay.com .
# 运行需挂载：-v /path/to/data:/app/data（含 yayanews.db）

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# better-sqlite3 需在 Linux 下本地编译
RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com
ARG NEXT_PUBLIC_PARENT_SITE=https://www.biyapay.com
ARG NEXT_PUBLIC_TRADING_SITE=https://invest.biyapay.com
ARG DATABASE_URL=postgresql://yayanews:yayanews_master@host.docker.internal:5432/yayanews
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_PARENT_SITE=$NEXT_PUBLIC_PARENT_SITE
ENV NEXT_PUBLIC_TRADING_SITE=$NEXT_PUBLIC_TRADING_SITE
ENV DATABASE_URL=$DATABASE_URL

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data

EXPOSE 3000
# 挂载 ./data 时多为 root 属主，需写 SQLite 时不使用非 root 用户
CMD ["node", "server.js"]
