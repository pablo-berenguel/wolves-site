FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG NUXT_PUBLIC_SITE_URL="http://localhost:3001"
ARG NUXT_PUBLIC_MATOMO_URL=""
ARG NUXT_PUBLIC_MATOMO_SITE_ID=""
ENV NUXT_PUBLIC_SITE_URL="$NUXT_PUBLIC_SITE_URL"
ENV NUXT_PUBLIC_MATOMO_URL="$NUXT_PUBLIC_MATOMO_URL"
ENV NUXT_PUBLIC_MATOMO_SITE_ID="$NUXT_PUBLIC_MATOMO_SITE_ID"

COPY . .
RUN pnpm exec nuxt prepare && pnpm build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner

WORKDIR /app

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="3000"

COPY --from=builder --chown=node:node /app/.output ./.output

# A named volume is mounted here in production. The directory ownership is
# copied into a new volume so the unprivileged Node user can write CMS data.
RUN mkdir -p /data/db /data/media/.staging && chown -R node:node /data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1

CMD ["node", ".output/server/index.mjs"]
