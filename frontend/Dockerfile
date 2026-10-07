# Build context is the repository root (packages/shared lives outside frontend/).
FROM node:26-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app/frontend
COPY --from=deps /app/frontend/node_modules ./node_modules
COPY frontend/ ./
COPY packages/shared/ /app/packages/shared/
RUN npm run build

# Static-export runner: next.config.mjs uses output:'export' (plain HTML in
# out/), so `next start` is not an option. nginx serves out/ on :3000 (the
# container contract). At startup inject-env.sh writes env-config.js into the
# web root and hands off to nginx's entrypoint, which envsubst-renders
# /etc/nginx/templates/default.conf.template (the /api proxy upstream) first.
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/out/ /usr/share/nginx/html/
COPY frontend/nginx-templates/ /etc/nginx/templates/
COPY frontend/inject-env.sh /usr/local/bin/inject-env.sh

RUN chmod +x /usr/local/bin/inject-env.sh

EXPOSE 3000

# Same-origin defaults: the frontend calls /api (proxied below), so no CORS.
# Override both in the server compose if the topology differs.
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS makes the image's 15-local-resolvers.envsh
# export NGINX_LOCAL_RESOLVERS (from /etc/resolv.conf) for the template.
ENV NEXT_PUBLIC_API_URL=/api
ENV GATEWAY_UPSTREAM=api-gateway:8080
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

ENTRYPOINT ["/usr/local/bin/inject-env.sh"]
