#!/bin/sh
set -e

# Wait for database to be ready by testing the connection
echo "Waiting for database to be ready..."
until PGPASSWORD=koin psql -h db -U koin -d koin -c '\q' 2>/dev/null; do
  echo "Database not ready, waiting 3s..."
  sleep 3
done

echo "Database ready! Running migrations..."
bun run db:migrate

echo "Starting development server with --watch..."
exec bun run --watch src/index.ts