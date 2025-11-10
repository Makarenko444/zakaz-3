# Инструкция: Добавление проксирования /api на Kong в Nginx

## Проблема
В текущей конфигурации Nginx отсутствует маршрут `/api`, который должен проксировать запросы на Kong API Gateway (порт 8000).

Клиентский код пытается обратиться к `https://zakaz2.tomica.ru/api`, но получает 404 или перенаправляется на Next.js.

## Решение
Добавить в Nginx конфигурацию маршрут для проксирования `/api` на Kong.

## Команды для production сервера

```bash
# 1. Откройте конфигурацию Nginx
sudo nano /etc/nginx/sites-available/zakaz2.tomica.ru

# 2. Добавьте ПЕРЕД блоком `location /` следующий блок:

    # Proxy /api requests to Supabase Kong API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Передаем все заголовки включая apikey
        proxy_pass_request_headers on;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

# 3. Проверьте конфигурацию
sudo nginx -t

# 4. Если проверка успешна, перезагрузите Nginx
sudo systemctl reload nginx

# 5. Проверьте что маршрут работает
curl -v https://zakaz2.tomica.ru/api/ \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q"
```

## Полная конфигурация сервера

```nginx
upstream zakaz3_upstream {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    server_name zakaz2.tomica.ru;

    # Логи
    access_log /var/log/nginx/zakaz2.tomica.ru-access.log;
    error_log /var/log/nginx/zakaz2.tomica.ru-error.log;

    # Размер загружаемых файлов
    client_max_body_size 50M;

    # Proxy /api requests to Supabase Kong API Gateway
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Передаем все заголовки включая apikey
        proxy_pass_request_headers on;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://zakaz3_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://zakaz3_upstream;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, max-age=3600, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://zakaz3_upstream;
        access_log off;
    }

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/zakaz2.tomica.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zakaz2.tomica.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = zakaz2.tomica.ru) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name zakaz2.tomica.ru;
    return 404;
}
```

## Примечание

Обратите внимание на порядок блоков `location`:
1. `/api/` - первым (для проксирования на Kong)
2. `/api/health` - специальный маршрут для health check (идет на Next.js)
3. `/` - последним (catch-all для Next.js)

Nginx использует первый подходящий маршрут, поэтому `/api/` перехватит все запросы к API перед тем как они попадут в `/`.
