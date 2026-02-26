# 🪙 Koin

Personal finance tracker built for AI integration.

## What's Different

**1. AI Agent Integration** — Generate a personalized `SKILL.md` from Settings. Drop it in your AI agent's workspace, and it can manage your finances via the API.

**2. AI Commands** — Use natural language to bulk update transactions:
- "Categorize all Starbucks as Food"
- "Move Netflix and Spotify to Entertainment"
- "Change last month's miscellaneous to expenses"

Changes are previewed before execution. No surprises.

**3. Simple Finance Tracking** — Income, expenses, categories, dashboard with charts. The basics, done right.

## Stack

- **Backend:** Bun + Hono + Drizzle ORM + PostgreSQL
- **Frontend:** React 19 + Vite + TailwindCSS + Recharts
- **AI:** OpenRouter (Claude, GPT, etc.)

## Quick Start

```bash
# With Docker
docker compose up
docker compose exec api bun run db:migrate

# Without Docker
bun install && cp .env.example .env
bun run db:migrate && bun run dev
cd web && bun install && bun run dev
```

- API: `http://localhost:3000`
- Frontend: `http://localhost:5173`

## Environment

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/koin
OPENROUTER_API_KEY=sk-or-...  # Optional, for AI features
OPENROUTER_MODEL=anthropic/claude-sonnet-4
```

## Testing

```bash
bun run test:all        # Backend + frontend
bun run test:docker     # Backend only
cd web && bun run test  # Frontend only
```

## AI Integration

1. Go to **Settings → API Tokens**
2. Create a token and copy the generated `SKILL.md`
3. Add it to your AI agent's workspace
4. Your agent can now log expenses, check balances, and manage categories

See [SKILL.md](./SKILL.md) for the full API reference.

## License

MIT
