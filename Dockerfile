FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Development
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "run", "dev"]

# Production build
FROM base AS prod
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
