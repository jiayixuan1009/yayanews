# 生产镜像：Next.js standalone（Linux x64）
# 需与 next.config.mjs 中 output: 'standalone' 一致
# 构建示例：
#   docker build -f infra/Dockerfile -t yayanews:latest \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com \
#     --build-arg NEXT_PUBLIC_PARENT_SITE=https://www.biyapay.com \
#     --build-arg NEXT_PUBLIC_TRADING_SITE=https://invest.biyapay.com .

FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_SITE_URL=https://yayanews.cryptooptiontool.com
ARG NEXT_PUBLIC_PARENT_SITE=https://www.biyapay.com
ARG NEXT_PUBLIC_TRADING_SITE=https://invest.biyapay.com
# DATABASE_URL is a runtime secret and must NOT be a build ARG.
# Pass it only at container runtime via environment or --env-file.
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_PARENT_SITE=$NEXT_PUBLIC_PARENT_SITE
ENV NEXT_PUBLIC_TRADING_SITE=$NEXT_PUBLIC_TRADING_SITE

RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

# Monorepo standalone 输出在 apps/web/.next/standalone/ 下
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3002
# 入口与 ecosystem.config.cjs 保持一致
CMD ["node", "apps/web/server.js"]
