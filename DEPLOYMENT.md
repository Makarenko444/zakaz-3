# Инструкция по деплою zakaz-3 на zakaz2.tomica.ru

## 📋 Предварительная подготовка

Все необходимые компоненты уже установлены на сервере:
- ✅ Node.js v20.19.4
- ✅ PM2 v6.0.10
- ✅ Docker & Docker Compose
- ✅ Nginx
- ✅ Supabase (работает в Docker)

## 🔑 Шаг 1: Получите ключи Supabase

На вашем сервере откройте Supabase Studio:

```bash
# Откройте в браузере
http://78.140.57.33:54323
```

Или если у вас есть домен для Supabase Studio, используйте его.

В Supabase Studio:
1. Перейдите в Settings → API
2. Скопируйте:
   - **Project URL** (должен быть `http://78.140.57.33:8000`)
   - **anon/public key**
   - **service_role key** (секретный, только для сервера)

## 🚀 Шаг 2: Автоматический деплой

На вашем сервере выполните:

```bash
# Подключитесь к серверу
ssh makarenko@78.140.57.33

# Скачайте и запустите deployment скрипт
curl -O https://raw.githubusercontent.com/Makarenko444/zakaz-3/claude/check-deployment-vm-011CUKpxfjRcBBSuLxQLeZBp/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

Скрипт запросит вас настроить `.env` файл. Откроется редактор, вставьте туда ваши ключи Supabase.

## 🔧 Шаг 3: Настройте Nginx

```bash
# Скопируйте конфигурацию nginx
sudo cp ~/apps/zakaz-3/nginx-zakaz2.conf /etc/nginx/sites-available/zakaz2.tomica.ru

# Создайте симлинк
sudo ln -s /etc/nginx/sites-available/zakaz2.tomica.ru /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите nginx
sudo systemctl reload nginx
```

## 🔒 Шаг 4: Настройте SSL (опционально, но рекомендуется)

```bash
# Установите certbot если еще не установлен
sudo apt install certbot python3-certbot-nginx -y

# Получите SSL сертификат
sudo certbot --nginx -d zakaz2.tomica.ru

# Certbot автоматически обновит конфигурацию nginx
```

## ✅ Шаг 5: Проверка

```bash
# Проверьте статус PM2
pm2 status

# Посмотрите логи
pm2 logs zakaz-3

# Проверьте что приложение отвечает
curl http://localhost:3001

# Проверьте через домен
curl http://zakaz2.tomica.ru
```

Откройте в браузере: `http://zakaz2.tomica.ru` (или `https://` если настроили SSL)

## 📝 Полезные команды PM2

```bash
# Посмотреть статус
pm2 status

# Посмотреть логи
pm2 logs zakaz-3

# Перезапустить
pm2 restart zakaz-3

# Остановить
pm2 stop zakaz-3

# Мониторинг в реальном времени
pm2 monit
```

## 🔄 Обновление приложения

```bash
cd ~/apps/zakaz-3
git pull origin claude/check-deployment-vm-011CUKpxfjRcBBSuLxQLeZBp
npm install
npm run build
pm2 restart zakaz-3
```

## 🐛 Устранение неполадок

### Приложение не запускается

```bash
# Проверьте логи
pm2 logs zakaz-3 --lines 100

# Проверьте .env файл
cat ~/apps/zakaz-3/.env

# Попробуйте запустить вручную
cd ~/apps/zakaz-3
npm run start
```

### Nginx возвращает 502 Bad Gateway

```bash
# Проверьте что PM2 приложение работает
pm2 status

# Проверьте что порт 3001 слушается
ss -tulpn | grep 3001

# Проверьте логи nginx
sudo tail -f /var/log/nginx/zakaz2.tomica.ru-error.log
```

### Высокая нагрузка сервера

У вас сейчас высокая загрузка (load average: 8+) и много zombie процессов. Возможно нужно:

```bash
# Найти zombie процессы
ps aux | grep 'Z'

# Проверить что потребляет ресурсы
htop

# Возможно нужно перезапустить некоторые Docker контейнеры
docker stats
```

## 🔗 Подключение к Supabase из Next.js

В вашем приложении установите клиент Supabase:

```bash
npm install @supabase/supabase-js
```

Создайте файл `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

## 📊 Мониторинг

```bash
# PM2 мониторинг
pm2 monit

# Логи в реальном времени
pm2 logs zakaz-3 --lines 200

# Использование ресурсов
pm2 show zakaz-3
```

## 🔐 Безопасность

1. ✅ Файрвол настроен (ufw)
2. ⚠️ Порт 3000 заблокирован (хорошо, используем 3001)
3. ⚠️ Рекомендуется настроить SSL
4. ⚠️ Убедитесь что `.env` не коммитится в git
5. ⚠️ Supabase service_role key храните в безопасности

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `pm2 logs zakaz-3`
2. Проверьте статус: `pm2 status`
3. Проверьте nginx: `sudo nginx -t`
4. Проверьте системные ресурсы: `htop`
