#!/usr/bin/env sh
set -e

if [ -d "backend" ]; then
  cd backend
fi

echo "Applying database migrations..."
alembic upgrade head
echo "Database migrations applied successfully."
