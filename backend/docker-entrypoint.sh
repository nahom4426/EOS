#!/bin/sh
set -e

echo "=========================================="
echo "✝️  Starting EOS Church Backend API..."
echo "=========================================="

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL database to accept connections..."
MAX_TRIES=30
COUNT=0

until pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; do
  COUNT=$((COUNT + 1))
  if [ $COUNT -ge $MAX_TRIES ]; then
    echo "❌ Timed out waiting for PostgreSQL at $DATABASE_URL"
    exit 1
  fi
  echo "   [attempt $COUNT/$MAX_TRIES] Database not ready yet, retrying in 2s..."
  sleep 2
done

echo "✅ PostgreSQL is ready and reachable!"

# Run database setup & seeding if enabled (default enabled)
if [ "${AUTO_DB_SETUP:-true}" = "true" ]; then
  echo "📦 Initializing database schema..."
  node src/db/setup.js || echo "⚠️ Database setup encountered non-fatal note."

  echo "🌱 Ensuring initial superadmin and settings are seeded..."
  node src/db/seedRunner.js || echo "⚠️ Superadmin seed encountered non-fatal note."
  node src/db/seedSettings.js || echo "⚠️ System settings seed encountered non-fatal note."
fi

echo "🚀 Starting Node server..."
exec node src/server.js
