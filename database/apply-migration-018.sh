#!/bin/bash

# Скрипт для применения миграции 018 - создание таблицы узлов

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Применение миграции 018: Создание таблицы узлов ===${NC}"

# Проверяем наличие переменных окружения
if [ -z "$SUPABASE_DB_URL" ]; then
  echo -e "${RED}Ошибка: переменная SUPABASE_DB_URL не установлена${NC}"
  echo "Установите переменную окружения SUPABASE_DB_URL"
  exit 1
fi

# Применяем миграцию
echo -e "${YELLOW}Применяем миграцию...${NC}"
psql "$SUPABASE_DB_URL" -f database/migrations/018_create_nodes_table.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Миграция успешно применена${NC}"

  # Проверяем результат
  echo -e "${YELLOW}Проверяем созданную таблицу...${NC}"
  psql "$SUPABASE_DB_URL" -c "\d zakaz_nodes"

  echo -e "${GREEN}✓ Миграция 018 завершена успешно${NC}"
else
  echo -e "${RED}✗ Ошибка при применении миграции${NC}"
  exit 1
fi
