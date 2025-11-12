# Отчет о прогрессе - 12 ноября 2025

## Обзор

Сегодня был полностью настроен и запущен dev-сервер на отдельной машине для разработки и тестирования перед развертыванием на production.

## Выполненные задачи

### 1. Настройка dev-сервера (ai.tomica.ru → zakaz3.tomica.ru)

#### Инфраструктура
- ✅ Установлен Node.js v24.11.1 через nvm
- ✅ Установлен npm v11.6.2
- ✅ Установлен PM2 v6.0.13 для управления процессами
- ✅ Настроен PM2 автозапуск при перезагрузке системы

#### Репозиторий и сборка
- ✅ Склонирован репозиторий zakaz-3 в `~/projects/zakaz-3`
- ✅ Установлены все зависимости через `npm install`
- ✅ Выполнена production сборка Next.js с Turbopack
- ✅ Приложение запущено через PM2 как `zakaz-3-dev`

#### Сетевая инфраструктура
- ✅ Настроен Caddy reverse proxy для домена zakaz3.tomica.ru
- ✅ Автоматически получен SSL сертификат от Let's Encrypt
- ✅ Настроен UFW firewall:
  - Открыт порт 3000/tcp для Docker сети (172.19.0.0/16)
  - Разрешены порты 80, 443 для HTTP/HTTPS

#### Подключение к Supabase
- ✅ Настроено подключение к production Supabase через внешний URL
- ✅ Использован HTTP endpoint (http://supabase.tomica.ru:8000) из-за self-signed сертификата
- ✅ Добавлены публичные переменные окружения для клиентской части Next.js
- ✅ Авторизация работает корректно

### 2. Улучшение безопасности production-сервера (zakaz2.tomica.ru)

#### Закрытие уязвимостей
- ✅ Обнаружены попытки брутфорс атак на PostgreSQL порт 5432
- ✅ Изменена конфигурация docker-compose.yml:
  - Было: `0.0.0.0:5432:5432` (открыт для всех)
  - Стало: `127.0.0.1:5432:5432` (только локально)
- ✅ Перезапущен контейнер supabase-db
- ✅ Проверена работоспособность после изменений

## Решенные проблемы

### Проблема 1: HTTP 502 Bad Gateway
**Симптомы:** zakaz3.tomica.ru возвращал 502 ошибку при попытке доступа

**Причина:** Caddy в Docker контейнере не мог подключиться к Next.js на хосте

**Решение:**
1. Определен gateway IP Docker сети web_proxy: `172.19.0.1`
2. Изменен Caddyfile: `reverse_proxy 172.19.0.1:3000`
3. Добавлено правило UFW: `allow from 172.19.0.0/16 to any port 3000`

### Проблема 2: Self-signed SSL сертификат Supabase
**Симптомы:** Node.js fetch отклонял HTTPS запросы к Supabase

**Причина:** Самоподписанный сертификат на https://supabase.tomica.ru:8443

**Решение:**
- Использован HTTP endpoint: http://supabase.tomica.ru:8000
- Обновлены переменные окружения в `.env.local`
- Выполнен полный rebuild приложения

### Проблема 3: Переменные окружения не обновлялись
**Симптомы:** После изменения `.env.local` авторизация не работала

**Причина:** PM2 restart не обновляет environment variables в Next.js build

**Решение:**
1. Удалить старый build: `rm -rf .next`
2. Пересобрать: `npm run build`
3. Перезапустить PM2: `pm2 delete && pm2 start`

### Проблема 4: PostgREST не мог подключиться к PostgreSQL
**Симптомы:** "could not translate host name 'db' to address"

**Причина:** Временные проблемы с Docker DNS resolver

**Решение:** Проблема решилась сама после нескольких попыток переподключения PostgREST

## Технические детали

### Характеристики серверов

**Dev сервер (ai.tomica.ru / zakaz3.tomica.ru):**
- CPU: 32 cores
- RAM: 61 GB
- Disk: 2 TB
- OS: Ubuntu
- IP: 78.140.55.90

**Production сервер (zakaz2.tomica.ru):**
- CPU: 32 cores
- RAM: 16 GB
- OS: Ubuntu
- IP: 78.140.57.33

### Конфигурация Caddy (dev сервер)

```caddy
ai.tomica.ru {
    encode zstd gzip
    reverse_proxy open-webui:8080
}

zakaz3.tomica.ru {
    encode zstd gzip
    reverse_proxy 172.19.0.1:3000
}
```

### Переменные окружения (dev сервер)

```bash
# Supabase Configuration
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_DIRECT_URL=http://supabase.tomica.ru:8000
NEXT_PUBLIC_SUPABASE_URL=http://supabase.tomica.ru:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
UPLOAD_DIR=/home/makar/zakaz-3-uploads
```

## Workflow разработки

### На dev сервере (zakaz3.tomica.ru)

```bash
cd ~/projects/zakaz-3
git pull origin main
npm run build
pm2 restart zakaz-3-dev
```

### На production сервере (zakaz2.tomica.ru)

```bash
cd ~/zakaz-3
git pull origin main
npm run build
pm2 restart zakaz-3
```

## Статистика

- **Время настройки:** ~2 часа
- **Количество решенных проблем:** 4 критических
- **Серверов настроено:** 2
- **Улучшений безопасности:** 1 (закрытие PostgreSQL порта)

## Следующие шаги

1. ✅ Dev сервер полностью настроен и работает
2. ✅ Production сервер защищен от внешних атак
3. ⏳ Тестирование функционала загрузки файлов на dev сервере
4. ⏳ Проверка работы всех фич перед развертыванием на production

## Заметки

- Dev и production используют **одну и ту же Supabase базу данных**
- Dev сервер подключается к Supabase через **внешний URL**
- Production подключается через **localhost**
- Все изменения в базе данных на dev **сразу видны на production**

## Важные команды

### Проверка статуса
```bash
pm2 status
pm2 logs zakaz-3-dev --lines 50
curl -I https://zakaz3.tomica.ru
```

### Перезапуск с обновлением env
```bash
pm2 delete zakaz-3-dev
rm -rf .next
npm run build
pm2 start npm --name "zakaz-3-dev" -- start
pm2 save
```

### Reload Caddy
```bash
sudo docker exec -w /etc/caddy caddy caddy reload
```
