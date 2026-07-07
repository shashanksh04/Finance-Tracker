#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Finance Tracker — Raspberry Pi 5 Deployment Script
# Target: ~/app on Raspberry Pi OS (bookworm), 8GB RAM, no Docker
# ============================================================

PI_USER="${PI_USER:-$USER}"
APP_DIR="${APP_DIR:-$HOME/app}"
PI_HOST="${PI_HOST:-raspberrypi.local}"

echo "=== Prerequisites ==="
echo "Before running, ensure you have:"
echo "  1. Raspberry Pi OS (bookworm) installed"
echo "  2. This script copied to the Pi at: $APP_DIR/deploy.sh"
echo "  3. A Cloudflare account (free) for tunnel"
echo "  4. An Ollama Cloud API key (https://cloud.ollama.com)"
echo ""
echo "To copy your code to the Pi, run from your dev machine:"
echo "  rsync -avz --exclude=__pycache__ --exclude=.git --exclude=node_modules --exclude=venv \\"
echo "    ./ root@${PI_HOST}:${APP_DIR}/"
echo ""
read -rp "Press Enter to continue or Ctrl+C to abort..."

# ---- Install system packages ----
echo ">>> Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl gnupg lsb-release ca-certificates \
  nginx postgresql postgresql-client \
  python3 python3-pip python3-dev \
  nodejs npm \
  redis-server

# ---- PostgreSQL setup ----
echo ">>> Configuring PostgreSQL..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='finance_user'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER finance_user WITH PASSWORD 'finance_pass';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='finance_db'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE finance_db OWNER finance_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_user;"

# ---- Python dependencies (system-wide, no venv) ----
echo ">>> Installing Python packages..."
sudo pip3 install --break-system-packages -r "$APP_DIR/backend/requirements.txt" 2>/dev/null || \
  sudo pip3 install -r "$APP_DIR/backend/requirements.txt"

# ---- Frontend build ----
echo ">>> Building frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build
sudo mkdir -p /var/www/finance-tracker
sudo cp -r dist/* /var/www/finance-tracker/

# ---- Environment config ----
echo ">>> Writing environment config..."
cp "$APP_DIR/backend/.env.example" "$APP_DIR/backend/.env" 2>/dev/null || true
cat > "$APP_DIR/backend/.env" << 'ENVEOF'
DATABASE_URL=postgresql+asyncpg://finance_user:finance_pass@localhost:5432/finance_db
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost,http://localhost:80,https://your-domain.trycloudflare.com
OLLAMA_BASE_URL=https://ollama.com  # Ollama Cloud
OLLAMA_MODEL=gpt-oss:120b-cloud
OLLAMA_API_KEY=your-ollama-cloud-api-key
UPLOAD_DIR=/var/www/finance-tracker/uploads
ENVEOF

sudo mkdir -p /var/www/finance-tracker/uploads
sudo chown -R "$PI_USER:$PI_USER" /var/www/finance-tracker

# ---- Alembic migrations ----
echo ">>> Running database migrations..."
cd "$APP_DIR/backend"
PYTHONPATH="$APP_DIR/backend" alembic upgrade head

# ---- Systemd service for FastAPI ----
echo ">>> Creating systemd service for FastAPI..."
sudo tee /etc/systemd/system/finance-api.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=Finance Tracker FastAPI Backend
After=network.target postgresql.service redis-server.service
Requires=postgresql.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/app/backend
Environment=PYTHONPATH=/home/pi/app/backend
ExecStart=/usr/bin/python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable finance-api
sudo systemctl start finance-api

# ---- Nginx config ----
echo ">>> Configuring Nginx..."
sudo tee /etc/nginx/sites-available/finance-tracker > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    client_max_body_size 50M;

    # Frontend static files
    root /var/www/finance-tracker;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/finance-tracker/uploads/;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/finance-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

# ---- Cloudflare Tunnel ----
echo ">>> Installing Cloudflare Tunnel..."
if ! command -v cloudflared &> /dev/null; then
  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o /tmp/cloudflared.deb
  sudo dpkg -i /tmp/cloudflared.deb
  rm /tmp/cloudflared.deb
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Configure Ollama Cloud:"
echo "     Edit $APP_DIR/backend/.env and set OLLAMA_API_KEY"
echo ""
echo "  2. Start Cloudflare Tunnel (one-time login + tunnel create):"
echo "     cloudflared tunnel login"
echo "     cloudflared tunnel create finance-tracker"
echo "     cloudflared tunnel route dns finance-tracker your-domain.com"
echo "     Then copy the tunnel credentials file and run:"
echo "     cloudflared tunnel run finance-tracker"
echo ""
echo "  3. Or use Quick Tunnel for testing:"
echo "     cloudflared tunnel --url http://localhost:80"
echo ""
echo "  4. Check service status:"
echo "     sudo systemctl status finance-api"
echo "     sudo systemctl status nginx"
echo "     sudo systemctl status postgresql"
echo ""
echo "  5. View logs:"
echo "     journalctl -u finance-api -f"
echo "     sudo tail -f /var/log/nginx/access.log"
echo ""
echo "Your app is running at: http://$(hostname -I | awk '{print $1}')"
