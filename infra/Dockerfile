# 生产镜像：Next.js standalone（Linux x64）
# 需与 next.config.mjs 中 output: 'standalone' 一致
# 构建示例：
#   docker build -t yayanews:latest \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com \
#     --build-arg NEXT_PUBLIC_PARENT_SITE=https://www.biyapay.com \
#     --build-arg NEXT_PUBLIC_TRADING_SITE=https://invest.biyapay.com .
# 运行需挂载：-v /path/to/data:/app/data（含 yayanews.db）

FROM node:20-bookworm-slim AS builder
WORKDIR /app

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

RUN mkdir -p /app/data

EXPOSE 3000
# 运行 Next.js standalone 进程
CMD ["node", "server.js"]
