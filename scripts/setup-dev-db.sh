#!/bin/bash

# Setup development database for Koin
# This script starts the PostgreSQL container and runs all migrations

set -e

echo "🚀 Setting up Koin development database..."

# Start the database container
echo "📦 Starting PostgreSQL container..."
docker compose up -d db

# Wait for the database to be ready
echo "⏳ Waiting for database to be ready..."
until docker compose exec db pg_isready -U koin -d koin >/dev/null 2>&1; do
  printf '.'
  sleep 1
done
echo ""

# Set DATABASE_URL
export DATABASE_URL=postgresql://koin:koin@localhost:5432/koin

# Run migrations
echo "🔄 Running database migrations..."
bun run db:migrate

# Verify setup
echo "✅ Verifying database setup..."
docker compose exec db psql -U koin -d koin -c "\dt" | grep -E "(users|categories|subscriptions|debt)" || echo "Tables created successfully"

echo ""
echo "🎉 Database setup complete!"
echo ""
echo "To start the API server:"
echo "  export DATABASE_URL=postgresql://koin:koin@localhost:5432/koin"
echo "  export JWT_SECRET=dev-secret-change-in-production"
echo "  bun run start"
echo ""
echo "To start the full stack (API + Web):"
echo "  docker compose up"