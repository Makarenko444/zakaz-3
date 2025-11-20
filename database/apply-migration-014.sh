#!/bin/bash

# Скрипт для применения миграции 014_update_user_roles
# Обновление ролей пользователей (в два шага из-за ограничений PostgreSQL)

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

# ШАГ 1: Добавление новых значений в enum
echo "Шаг 1/2: Добавление новых значений в enum (manager, installer, supply)..."
psql "$POSTGRES_URL" -f /home/user/zakaz-3/database/migrations/014_update_user_roles_step1.sql

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ Ошибка при выполнении шага 1"
    exit 1
fi

echo "✓ Шаг 1 выполнен успешно"
echo ""
echo "Ожидание фиксации транзакции..."
sleep 2

# ШАГ 2: Обновление данных и очистка старых значений
echo ""
echo "Шаг 2/2: Обновление данных и пересоздание enum..."
psql "$POSTGRES_URL" -f /home/user/zakaz-3/database/migrations/014_update_user_roles_step2.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Миграция успешно применена!"
    echo ""
    echo "Изменения:"
    echo "- Роль 'operator' заменена на 'manager'"
    echo "- Роль 'lead' заменена на 'manager'"
    echo "- Добавлены новые роли: 'installer', 'supply'"
    echo "- Enum очищен от старых значений 'operator' и 'lead'"
    echo ""
else
    echo ""
    echo "✗ Ошибка при выполнении шага 2"
    echo ""
    echo "ВНИМАНИЕ: Шаг 1 уже выполнен!"
    echo "Значения 'manager', 'installer', 'supply' добавлены в enum."
    echo "Попробуйте выполнить шаг 2 отдельно:"
    echo "psql \"\$POSTGRES_URL\" -f database/migrations/014_update_user_roles_step2.sql"
    exit 1
fi
