#!/bin/bash
set -e
cd /app/backend
echo "Running database migrations..."
alembic upgrade head
echo "Starting supervisord..."
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf