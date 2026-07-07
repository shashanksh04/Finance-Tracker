FROM --platform=linux/arm64 node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM --platform=linux/arm64 python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y nginx supervisor && rm -rf /var/lib/apt/lists/* && \
    rm -rf /usr/share/doc/* /usr/share/man/* /var/cache/apt/archives/*

RUN addgroup --system app && adduser --system --ingroup app app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    rm -rf /root/.cache/pip

COPY backend/ /app/backend/
COPY --from=frontend-builder /app/dist/ /var/www/finance-tracker/
COPY nginx.conf /etc/nginx/sites-enabled/default
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /var/www/finance-tracker/uploads && \
    chown -R app:app /app /var/www/finance-tracker /entrypoint.sh

WORKDIR /app/backend
USER app
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
