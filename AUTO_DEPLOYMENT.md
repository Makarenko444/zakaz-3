# Автоматический деплой на VPS

Настройка автоматического деплоя через GitHub Actions на ваш VPS.

## Преимущества

- ✅ Автоматический деплой при push в GitHub
- ✅ Проверка работоспособности (health check)
- ✅ Автоматический rollback при ошибках
- ✅ Резервные копии перед каждым деплоем
- ✅ Уведомления о статусе деплоя

## Настройка

### 1️⃣ Создайте SSH ключ для GitHub Actions

На вашем **локальном компьютере** или **на сервере**:

```bash
# Создайте новый SSH ключ (без пароля для автоматизации)
ssh-keygen -t ed25519 -C "github-actions-zakaz3" -f ~/.ssh/github_actions_zakaz3 -N ""

# Скопируйте приватный ключ (понадобится для GitHub Secrets)
cat ~/.ssh/github_actions_zakaz3

# Скопируйте публичный ключ (добавим на сервер)
cat ~/.ssh/github_actions_zakaz3.pub
```

### 2️⃣ Добавьте публичный ключ на VPS

На вашем **VPS** (ssh makarenko@78.140.57.33):

```bash
# Добавьте публичный ключ в authorized_keys
echo "ssh-ed25519 AAAA... github-actions-zakaz3" >> ~/.ssh/authorized_keys

# Установите правильные права
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### 3️⃣ Протестируйте SSH подключение

На вашем **локальном компьютере**:

```bash
# Проверьте что можете подключиться с новым ключом
ssh -i ~/.ssh/github_actions_zakaz3 makarenko@78.140.57.33 "echo 'Connection successful!'"
```

### 4️⃣ Добавьте GitHub Secrets

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret** и добавьте:

**VPS_HOST:**
```
78.140.57.33
```

**VPS_USERNAME:**
```
makarenko
```

**VPS_SSH_KEY:**
```
(вставьте содержимое файла ~/.ssh/github_actions_zakaz3 - ПРИВАТНЫЙ ключ)
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
...
-----END OPENSSH PRIVATE KEY-----
```

### 5️⃣ Создайте deployment скрипт на сервере

На вашем **VPS**:

```bash
# Скопируйте скрипт из репозитория
cd ~/apps/zakaz-3
git pull

# Создайте директорию для скриптов если её нет
mkdir -p scripts

# Сделайте скрипт исполняемым
chmod +x scripts/deploy-server.sh

# Создайте директорию для бэкапов
mkdir -p ~/backups/zakaz-3
```

### 6️⃣ Протестируйте деплой вручную

```bash
# Запустите deployment скрипт вручную
cd ~/apps/zakaz-3
./scripts/deploy-server.sh
```

Если всё работает, скрипт:
1. Сделает бэкап
2. Скачает изменения из GitHub
3. Установит зависимости
4. Соберёт проект
5. Перезапустит PM2
6. Проверит работоспособность

### 7️⃣ Закоммитьте и запушьте workflow

На вашем **локальном компьютере**:

```bash
cd /path/to/zakaz-3

# Добавьте файлы
git add .github/workflows/deploy.yml
git add scripts/deploy-server.sh
git add AUTO_DEPLOYMENT.md

# Закоммитьте
git commit -m "feat: add auto-deployment via GitHub Actions"

# Запушьте
git push origin your-branch-name
```

### 8️⃣ Настройте ветку для автодеплоя

По умолчанию workflow срабатывает на:
- Push в ветку `main`
- Push в ветку `claude/check-deployment-vm-011CUKpxfjRcBBSuLxQLeZBp`

Чтобы изменить, отредактируйте `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - main  # <-- Измените здесь
```

## Использование

### Автоматический деплой

Просто сделайте push в настроенную ветку:

```bash
git add .
git commit -m "feat: new feature"
git push origin main
```

GitHub Actions автоматически:
1. Подключится к VPS по SSH
2. Запустит deployment скрипт
3. Выполнит деплой
4. Покажет результат в GitHub

### Ручной деплой через GitHub UI

1. Откройте GitHub → **Actions**
2. Выберите workflow **Deploy to VPS**
3. Нажмите **Run workflow**
4. Выберите ветку
5. Нажмите **Run workflow**

### Ручной деплой на сервере

```bash
ssh makarenko@78.140.57.33
cd ~/apps/zakaz-3
./scripts/deploy-server.sh main  # или другую ветку
```

## Мониторинг деплоя

### Просмотр логов GitHub Actions

1. Откройте GitHub → **Actions**
2. Выберите последний запуск workflow
3. Посмотрите логи

### Просмотр логов на сервере

```bash
# PM2 логи
pm2 logs zakaz-3

# Последние 100 строк
pm2 logs zakaz-3 --lines 100

# Только ошибки
pm2 logs zakaz-3 --err
```

## Rollback (откат изменений)

### Автоматический rollback

Если health check не проходит, скрипт автоматически откатится к предыдущей версии.

### Ручной rollback

```bash
ssh makarenko@78.140.57.33
cd ~/apps/zakaz-3

# Посмотрите список коммитов
git log --oneline -10

# Откатитесь к нужному коммиту
git reset --hard <commit-hash>

# Переустановите и пересоберите
npm ci
npm run build
pm2 restart zakaz-3

# Или восстановите из бэкапа
ls ~/backups/zakaz-3/
cp -r ~/backups/zakaz-3/backup-YYYYMMDD-HHMMSS ~/apps/zakaz-3/.next
pm2 restart zakaz-3
```

## Устранение неполадок

### SSH подключение не работает

```bash
# Проверьте что ключ добавлен
ssh -i ~/.ssh/github_actions_zakaz3 -v makarenko@78.140.57.33

# Проверьте права на файлы
ls -la ~/.ssh/

# Должно быть:
# -rw------- authorized_keys (600)
# drwx------ .ssh (700)
```

### Деплой завершается с ошибкой

```bash
# Посмотрите логи PM2
pm2 logs zakaz-3 --lines 200

# Проверьте что .env файл на месте
cat ~/apps/zakaz-3/.env

# Проверьте свободное место
df -h

# Проверьте память
free -h
```

### Build падает с ошибкой памяти

Если на сервере мало памяти, можно собирать локально:

```bash
# На локальном компьютере
npm run build

# Загрузите .next на сервер
rsync -avz .next/ makarenko@78.140.57.33:~/apps/zakaz-3/.next/

# На сервере просто перезапустите
ssh makarenko@78.140.57.33 "pm2 restart zakaz-3"
```

## Дополнительные возможности

### Уведомления в Telegram

Добавьте в `.github/workflows/deploy.yml`:

```yaml
- name: Send Telegram notification
  if: always()
  uses: appleboy/telegram-action@master
  with:
    to: ${{ secrets.TELEGRAM_CHAT_ID }}
    token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    message: |
      🚀 Deployment ${{ job.status }}
      Repository: ${{ github.repository }}
      Branch: ${{ github.ref_name }}
      Commit: ${{ github.sha }}
      URL: https://zakaz2.tomica.ru
```

### Deploy preview для feature веток

Можно настроить отдельные инстансы для каждой ветки на разных портах.

### Тесты перед деплоем

Добавьте в workflow перед деплоем:

```yaml
- name: Run tests
  run: |
    npm install
    npm test
```

## Полезные ссылки

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SSH Action](https://github.com/appleboy/ssh-action)
- [PM2 Documentation](https://pm2.keymetrics.io/)
