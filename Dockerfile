FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

# Run migrations and seed with the exact source and dependencies of this release.
FROM base AS migrate
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "db:migrate"]

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/.next/cache /app/data && chown -R node:node /app/.next/cache /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
