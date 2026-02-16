# 🪙 Koin

Personal finance management API. Built for AI-first workflows.

## Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [Hono](https://hono.dev)
- **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)
- **Validation:** [Zod](https://zod.dev)

## Quick Start

### With Docker (recommended)

```bash
# Start API + PostgreSQL
docker compose up

# Run migrations (in another terminal)
docker compose exec api bun run db:generate
docker compose exec api bun run db:migrate

# Optional: Drizzle Studio (DB GUI)
docker compose --profile tools up studio
```

API available at `http://localhost:3000`

### Without Docker

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Run migrations
bun run db:generate
bun run db:migrate

# Start dev server
bun run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions/:id` | Get transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| GET | `/api/summary` | Financial summary |

## AI Integration

See [SKILL.md](./SKILL.md) for API usage instructions designed for AI agents.

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/koin
PORT=3000
```

## Development

```bash
# Generate migration after schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Open Drizzle Studio (DB GUI)
bun run db:studio
```

## License

MIT
