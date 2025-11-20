#!/bin/bash

# Скрипт для применения миграции 014_update_user_roles.sql
# Обновление ролей пользователей

echo "===================================="
echo "Применение миграции 014"
echo "Обновление ролей пользователей"
echo "===================================="
echo ""

# Проверка наличия переменных окружения
if [ -z "$POSTGRES_URL" ]; then
    echo "Ошибка: Переменная POSTGRES_URL не установлена"
    echo "Установите её через: export POSTGRES_URL='your-connection-string'"
    exit 1
fi

# Применение миграции
echo "Применение миграции..."
psql "$POSTGRES_URL" -f /home/user/zakaz-3/database/migrations/014_update_user_roles.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Миграция успешно применена!"
    echo ""
    echo "Изменения:"
    echo "- Роль 'operator' заменена на 'manager'"
    echo "- Роль 'lead' заменена на 'manager'"
    echo "- Добавлены новые роли: 'installer', 'supply'"
    echo ""
else
    echo ""
    echo "✗ Ошибка при применении миграции"
    exit 1
fi
