# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build behind a TLS-intercepting proxy
#
# Corporate networks and sandboxed CI runners often route egress through a
# proxy that re-signs TLS. Two optional hooks make the build work there without
# changing anything for everyone else:
#
#   * --build-arg HTTP_PROXY / HTTPS_PROXY / NO_PROXY
#   * drop the proxy's root certificate at docker/certs/ca.crt — it is picked
#     up automatically by npm and Node if present, and ignored if absent.
#
# See docs/DEPLOYMENT.md.
# ---------------------------------------------------------------------------

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

ARG HTTP_PROXY=
ARG HTTPS_PROXY=
ARG NO_PROXY=
ENV HTTP_PROXY=${HTTP_PROXY} HTTPS_PROXY=${HTTPS_PROXY} NO_PROXY=${NO_PROXY}
ENV http_proxy=${HTTP_PROXY} https_proxy=${HTTPS_PROXY} no_proxy=${NO_PROXY}

# Optional extra CA. The directory always exists in the build context, so the
# COPY never fails; the certificate inside it is optional.
COPY docker/certs/ /usr/local/share/extra-ca/

COPY package.json package-lock.json* ./
RUN set -eu; \
    if [ -f /usr/local/share/extra-ca/ca.crt ]; then \
      cat /usr/local/share/extra-ca/ca.crt >> /etc/ssl/certs/ca-certificates.crt; \
      export NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca/ca.crt; \
      npm config set cafile /usr/local/share/extra-ca/ca.crt; \
    fi; \
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runner ----------
# Carries both the compiled standalone server and the toolchain the one-shot
# `migrate` service needs (tsx + drizzle + pg + the dataset sources).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs db ./db
COPY --chown=nextjs:nodejs data ./data
COPY --chown=nextjs:nodejs lib ./lib
COPY --chown=nextjs:nodejs ingest ./ingest
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs tsconfig.json package.json ./

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
