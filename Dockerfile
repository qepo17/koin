FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Development
FROM base AS dev
# Install PostgreSQL client for database readiness check
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker-entrypoint-dev.sh ./
RUN chmod +x docker-entrypoint-dev.sh
CMD ["./docker-entrypoint-dev.sh"]

# Production build
FROM base AS prod
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
