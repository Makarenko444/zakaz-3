# Схема развертывания и работы с серверами

## Обзор архитектуры

Проект использует **двухсерверную архитектуру** для безопасной разработки и развертывания:

1. **Dev сервер (zakaz3.tomica.ru)** - для разработки и тестирования
2. **Production сервер (zakaz2.tomica.ru)** - боевая версия для пользователей

Оба сервера используют **общую Supabase базу данных**, расположенную на production сервере.

---

## Серверы

### Dev сервер (zakaz3.tomica.ru)

**Назначение:** Разработка, тестирование новых фич, отладка

**Характеристики:**
- Домен: `zakaz3.tomica.ru`
- IP: `78.140.55.90`
- CPU: 32 cores
- RAM: 61 GB
- Disk: 2 TB
- OS: Ubuntu
- User: `makar`

**Установленное ПО:**
- Node.js v24.11.1 (через nvm)
- npm v11.6.2
- PM2 v6.0.13
- Caddy (в Docker)
- Git

**Расположение проекта:**
```
~/projects/zakaz-3/
```

**PM2 процесс:**
```
zakaz-3-dev
```

**Доступ:**
- HTTPS: https://zakaz3.tomica.ru
- Next.js: http://localhost:3000

---

### Production сервер (zakaz2.tomica.ru)

**Назначение:** Боевое приложение для реальных пользователей

**Характеристики:**
- Домен: `zakaz2.tomica.ru`
- IP: `78.140.57.33`
- CPU: 32 cores
- RAM: 16 GB
- OS: Ubuntu
- User: `makarenko`

**Установленное ПО:**
- Node.js (через nvm)
- npm
- PM2
- Nginx
- Docker (Supabase)

**Расположение проекта:**
```
~/zakaz-3/
```

**PM2 процесс:**
```
zakaz-3
```

**Доступ:**
- HTTPS: https://zakaz2.tomica.ru
- Next.js: http://localhost:3000

---

## Supabase (База данных)

**Расположение:** Production сервер (zakaz2.tomica.ru)

**Компоненты:**
- PostgreSQL 15.8.1
- PostgREST v12.2.12
- Kong Gateway 2.8.1
- GoTrue (Auth)
- Storage API
- Realtime
- Studio

**Endpoints:**

### Внутренний (production использует этот):
```
http://localhost:8000     - Kong API Gateway
http://localhost:5432     - PostgreSQL (закрыт извне)
http://localhost:54323    - Supabase Studio
```

### Внешний (dev сервер использует этот):
```
http://supabase.tomica.ru:8000     - Kong API Gateway
https://supabase.tomica.ru:8443    - Kong API Gateway (HTTPS, self-signed cert)
```

**Важно:** Порт PostgreSQL 5432 закрыт от внешних подключений для безопасности.

---

## Схема подключений

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
                │ HTTPS                   │ HTTPS
                │                         │
        ┌───────▼──────────┐      ┌──────▼──────────┐
        │  zakaz3.tomica.ru│      │ zakaz2.tomica.ru│
        │   (Dev Server)   │      │ (Production)    │
        │                  │      │                  │
        │  Next.js :3000   │      │  Next.js :3000  │
        │  ↕ Caddy         │      │  ↕ Nginx        │
        │  PM2: zakaz-3-dev│      │  PM2: zakaz-3   │
        └──────────┬────────┘      └──────┬──────────┘
                   │                      │
                   │ HTTP                 │ HTTP
                   │ :8000                │ :8000
                   │                      │
                   │         ┌────────────▼─────┐
                   │         │   Supabase       │
                   └─────────► ┌──────────────┐ │
                             │ │ Kong :8000   │ │
                             │ └──────┬───────┘ │
                             │        │         │
                             │ ┌──────▼───────┐ │
                             │ │ PostgREST    │ │
                             │ └──────┬───────┘ │
                             │        │         │
                             │ ┌──────▼───────┐ │
                             │ │ PostgreSQL   │ │
                             │ │ :5432        │ │
                             │ │ (localhost)  │ │
                             │ └──────────────┘ │
                             └──────────────────┘
```

---

## Workflow разработки

### 1. Разработка на Dev сервере

**Подключение к dev серверу:**
```bash
ssh makar@ai.tomica.ru
cd ~/projects/zakaz-3
```

**Получить последние изменения:**
```bash
git pull origin main
```

**Внести изменения:**
```bash
# Редактируйте файлы
nano app/...
```

**Тестирование:**
```bash
npm run build
pm2 restart zakaz-3-dev
pm2 logs zakaz-3-dev --lines 50
```

**Проверка в браузере:**
```
https://zakaz3.tomica.ru
```

### 2. Коммит изменений

**Создание ветки:**
```bash
git checkout -b claude/feature-name-<session-id>
```

**Коммит:**
```bash
git add .
git commit -m "Описание изменений"
```

**Пуш:**
```bash
git push -u origin claude/feature-name-<session-id>
```

### 3. Pull Request

**Создание PR через GitHub CLI (если доступен):**
```bash
gh pr create --title "Название PR" --body "Описание"
```

**Или через веб-интерфейс GitHub**

### 4. Развертывание на Production

**После мержа PR, на production сервере:**

```bash
ssh makarenko@zakaz2.tomica.ru
cd ~/zakaz-3
git pull origin main
npm run build
pm2 restart zakaz-3
pm2 logs zakaz-3 --lines 50
```

**Проверка:**
```
https://zakaz2.tomica.ru
```

---

## Конфигурационные файлы

### Dev сервер

**~/.env.local**
```bash
# Supabase Configuration
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_DIRECT_URL=http://supabase.tomica.ru:8000

# Public keys
NEXT_PUBLIC_SUPABASE_URL=http://supabase.tomica.ru:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

UPLOAD_DIR=/home/makar/zakaz-3-uploads
```

**~/Caddyfile**
```caddy
zakaz3.tomica.ru {
    encode zstd gzip
    reverse_proxy 172.19.0.1:3000
}
```

### Production сервер

**~/.env.local**
```bash
# Supabase Configuration
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_DIRECT_URL=http://localhost:8000

# Public keys
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

UPLOAD_DIR=/home/makarenko/zakaz-3-uploads
```

---

## Важные команды

### PM2 управление

```bash
# Статус
pm2 status

# Логи
pm2 logs <process-name> --lines 50
pm2 logs <process-name> --follow

# Рестарт
pm2 restart <process-name>

# Полный перезапуск с rebuild
pm2 delete <process-name>
rm -rf .next
npm run build
pm2 start npm --name "<process-name>" -- start
pm2 save
```

### Проверка работы

```bash
# Проверка Next.js локально
curl -I http://localhost:3000

# Проверка через домен
curl -I https://zakaz3.tomica.ru  # dev
curl -I https://zakaz2.tomica.ru  # production

# Проверка Supabase
curl -I http://localhost:8000      # production
curl -I http://supabase.tomica.ru:8000  # dev
```

### Работа с Caddy (dev)

```bash
# Проверка конфигурации
sudo docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Reload конфигурации
sudo docker exec -w /etc/caddy caddy caddy reload

# Логи
sudo docker logs caddy --tail 50
```

### Работа с Nginx (production)

```bash
# Проверка конфигурации
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Логи
sudo tail -f /var/log/nginx/error.log
```

---

## Безопасность

### Firewall (UFW)

**Dev сервер:**
```bash
# Разрешить Docker сети доступ к Next.js
sudo ufw allow from 172.19.0.0/16 to any port 3000 proto tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

**Production сервер:**
```bash
# PostgreSQL закрыт извне (только localhost)
# Настроено в docker-compose.yml:
# ports:
#   - "127.0.0.1:5432:5432"

# HTTP/HTTPS открыты
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Supabase безопасность

- PostgreSQL порт 5432 закрыт от внешних подключений
- Доступ только через Kong API Gateway на порту 8000
- Service Role Key хранится только на сервере в .env.local
- Anon Key используется для клиентских запросов

---

## Troubleshooting

### Dev сервер не может подключиться к Supabase

**Проблема:** "TypeError: fetch failed"

**Решения:**
1. Проверьте доступность Supabase: `curl -I http://supabase.tomica.ru:8000`
2. Проверьте переменные окружения в `.env.local`
3. Пересоберите приложение: `rm -rf .next && npm run build`

### 502 Bad Gateway на zakaz3.tomica.ru

**Проблема:** Caddy не может подключиться к Next.js

**Решения:**
1. Проверьте статус PM2: `pm2 status`
2. Проверьте порт: `netstat -tulpn | grep :3000`
3. Проверьте UFW: `sudo ufw status | grep 3000`
4. Проверьте IP в Caddyfile: должен быть `172.19.0.1:3000`

### PostgREST не может подключиться к базе

**Проблема:** "could not translate host name 'db' to address"

**Решения:**
1. Проверьте Docker сеть: `sudo docker network inspect <network-name>`
2. Перезапустите PostgREST: `sudo docker restart supabase-rest`
3. Проверьте логи: `sudo docker logs supabase-rest --tail 50`

### Старый код после pm2 restart

**Проблема:** Изменения не применяются после `pm2 restart`

**Решение:**
```bash
pm2 delete <process-name>
rm -rf .next
npm run build
pm2 start npm --name "<process-name>" -- start
pm2 save
```

---

## Мониторинг

### Проверка здоровья системы

```bash
# Нагрузка
uptime

# Память
free -h

# Диск
df -h

# PM2 мониторинг
pm2 monit

# Docker контейнеры
sudo docker ps
sudo docker stats --no-stream
```

### Логи

**Next.js:**
```bash
pm2 logs <process-name> --lines 100
```

**Supabase:**
```bash
sudo docker logs supabase-db --tail 100
sudo docker logs supabase-rest --tail 100
sudo docker logs supabase-kong --tail 100
```

**System:**
```bash
sudo journalctl -u pm2-<user> -n 100
```

---

## Бэкапы

### База данных

```bash
# Создание бэкапа PostgreSQL
sudo docker exec supabase-db pg_dump -U postgres postgres > backup-$(date +%Y%m%d).sql

# Восстановление
cat backup-20251112.sql | sudo docker exec -i supabase-db psql -U postgres postgres
```

### Файлы проекта

```bash
# Dev
tar -czf zakaz-3-dev-backup-$(date +%Y%m%d).tar.gz ~/projects/zakaz-3

# Production
tar -czf zakaz-3-prod-backup-$(date +%Y%m%d).tar.gz ~/zakaz-3
```

---

## Контакты и доступы

**Dev сервер:**
- SSH: `makar@ai.tomica.ru`
- URL: https://zakaz3.tomica.ru

**Production сервер:**
- SSH: `makarenko@zakaz2.tomica.ru`
- URL: https://zakaz2.tomica.ru

**GitHub:**
- Repository: https://github.com/Makarenko444/zakaz-3
- Issues: https://github.com/Makarenko444/zakaz-3/issues

---

## Changelog

- **2025-11-12:** Настроен dev сервер zakaz3.tomica.ru, закрыт PostgreSQL порт на production
- **2025-11-11:** Добавлена функциональность прикрепления файлов к комментариям
- **2025-11-10:** Исправлены проблемы с аудит логами и авторизацией
