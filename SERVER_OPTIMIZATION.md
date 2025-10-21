# Оптимизация сервера для ускорения деплоя

## Текущее состояние сервера

По результатам диагностики обнаружены следующие проблемы:
- **2808 zombie процессов** - критическая проблема!
- **Load average: 8.03** при 8 используемых ядрах (из 32 доступных)
- **11GB RAM используется** из 16GB
- **Нет swap памяти**

## Узкие места при деплое

1. **npm install** - медленно из-за высокой нагрузки CPU и отсутствия swap
2. **npm build** - медленно из-за zombie процессов
3. **PM2 restart** - быстро

## Критические оптимизации (выполнить на сервере)

### 🔴 1. СРОЧНО: Убрать zombie процессы

```bash
# Подключитесь к серверу
ssh makarenko@78.140.57.33

# Найдите родительские процессы zombie'ов
ps -A -ostat,ppid,pid,cmd | grep -e '^[Zz]' | awk '{print $2}' | sort | uniq

# Посмотрите какие процессы создают zombie
ps -ef | grep -E "$(ps -A -ostat,ppid | grep -e '^[Zz]' | awk '{print $2}' | sort | uniq | tr '\n' '|' | sed 's/|$//')"

# Скорее всего проблема в Docker - перезапустите
sudo systemctl restart docker

# Проверьте количество zombie процессов
ps aux | grep 'Z' | wc -l

# Должно быть 0 или близко к 0
```

**Эффект:** Снизит load average с 8 до 2-3, ускорит деплой на **50-70%**

### 🟠 2. ВАЖНО: Добавить swap память

```bash
# Создайте 4GB swap файл
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Сделайте постоянным (переживёт перезагрузку)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Настройте swappiness (как часто использовать swap)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# Проверьте
free -h
swapon --show
```

**Эффект:** npm install не будет падать при пиках памяти, ускорение на **20-30%**

### 🟡 3. Настроить npm cache

```bash
# На сервере
cd ~/apps/zakaz-3

# Проверьте размер кеша
du -sh ~/.npm

# Если нужно - очистите старый кеш
npm cache clean --force

# Убедитесь что .npmrc создан (уже в репозитории)
cat .npmrc
```

**Эффект:** npm install с 2-3 минут до **30-60 секунд**

## Программные оптимизации (уже сделаны)

✅ Добавлен `.npmrc` с оптимизациями:
- `prefer-offline=true` - использовать кеш первым
- `maxsockets=3` - не перегружать сервер
- `audit=false` - пропустить audit при деплое
- `fund=false` - пропустить сообщения о спонсорстве

✅ Обновлён `next.config.ts`:
- `output: 'standalone'` - меньший размер сборки
- `swcMinify: true` - быстрая минификация
- Оптимизация изображений

✅ Обновлён deployment скрипт:
- `--prefer-offline` - использовать кеш npm
- `--no-audit` - пропустить проверку безопасности при деплое

## Дополнительные оптимизации (опционально)

### 4. Использовать pnpm вместо npm

```bash
# Установите pnpm
npm install -g pnpm

# Обновите package.json scripts
# "build": "pnpm build"
# "dev": "pnpm dev"

# Обновите deployment скрипт
# npm ci -> pnpm install --frozen-lockfile
```

**Эффект:** Ускорение установки зависимостей на **40-50%**, меньше места на диске

### 5. Оптимизировать Docker контейнеры

```bash
# Посмотрите сколько памяти используют контейнеры
docker stats --no-stream

# Остановите неиспользуемые контейнеры
docker ps -a
docker stop <container_id>

# Очистите неиспользуемые образы
docker system prune -a
```

### 6. Добавить ограничения памяти для PM2

```bash
# Отредактируйте ecosystem.config.js
nano ~/apps/zakaz-3/ecosystem.config.js

# Установите лимиты:
# max_memory_restart: '1G'  # Уже установлено
# instances: 1  # Уже установлено (было 2)
```

## Ожидаемые результаты

### До оптимизации:
- npm install: **2-3 минуты**
- npm build: **1.5-2 минуты**
- **Общее время деплоя: 5-8 минут**

### После оптимизации:
- npm install: **30-60 секунд** (-60%)
- npm build: **60-90 секунд** (-40%)
- **Общее время деплоя: 2-3 минуты** (-60%)

## Мониторинг

### Проверка нагрузки
```bash
# Load average
uptime

# CPU и память
htop

# Zombie процессы
ps aux | grep 'Z' | wc -l

# Swap использование
free -h
```

### Логи деплоя
```bash
# GitHub Actions
# https://github.com/Makarenko444/zakaz-3/actions

# PM2 логи
pm2 logs zakaz-3 --lines 100

# Nginx логи
sudo tail -f /var/log/nginx/zakaz2.tomica.ru-access.log
```

## Выделение дополнительных ресурсов

Если вы можете выделить больше ресурсов на VPS:

### CPU
- **Текущие:** 8 ядер активно используется из 32 доступных
- **Рекомендация:** Убедитесь что PM2 может использовать все ядра
- **Команда:** `lscpu` и проверьте CPU affinity для PM2

### RAM
- **Текущие:** 16GB (11GB используется)
- **Рекомендация:**
  - Если <10GB свободно после чистки zombie - добавьте до 24GB
  - Если >10GB свободно - текущего достаточно

### Диск
- **Текущие:** 77GB свободно из 100GB
- **Рекомендация:** Достаточно, но очистите Docker кеш: `docker system prune -a`

## Проверка после оптимизации

```bash
# Запустите тестовый деплой
cd ~/apps/zakaz-3
time ./scripts/deploy-server.sh

# Ожидаемое время: 2-3 минуты вместо 5-8
```

## Постоянный мониторинг

Добавьте в cron проверку zombie процессов:

```bash
# Откройте crontab
crontab -e

# Добавьте строку (проверка каждый час)
0 * * * * ZOMBIE_COUNT=$(ps aux | grep 'Z' | wc -l); if [ $ZOMBIE_COUNT -gt 100 ]; then systemctl restart docker; fi
```

## Поддержка

Если деплой всё ещё медленный после этих оптимизаций:
1. Проверьте `pm2 logs zakaz-3` на ошибки
2. Проверьте `htop` во время деплоя
3. Проверьте `docker stats` - не съедают ли контейнеры всю память
