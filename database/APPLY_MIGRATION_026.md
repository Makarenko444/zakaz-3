# Применение миграции 026

## Важно!
Перед деплоем необходимо применить миграцию к базе данных.

## Инструкция

1. Откройте Supabase SQL Editor:
   - Перейдите в панель управления Supabase
   - Откройте раздел "SQL Editor"

2. Скопируйте и выполните следующий SQL:

```sql
-- Migration 026: Add 'not_present' status to node_status enum
-- Description: Adds a new status for addresses where we don't have presence yet

-- Add the new value to the enum
ALTER TYPE node_status ADD VALUE IF NOT EXISTS 'not_present';

-- Create a comment explaining the new status
COMMENT ON TYPE node_status IS 'Status of the node: existing (currently deployed), planned (to be deployed), not_present (address where we have no presence)';
```

3. Нажмите "Run" или Ctrl+Enter

4. Убедитесь, что миграция прошла успешно (не должно быть ошибок)

## Проверка

После применения миграции вы можете проверить, что новое значение добавлено:

```sql
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'node_status'::regtype
ORDER BY enumsortorder;
```

Должно вывести:
- existing
- planned
- not_present

## Что изменится

После применения миграции:
- При создании нового адреса можно будет выбрать статус "Не присутствуем"
- Это значение по умолчанию для новых адресов
- Адреса с этим статусом будут отображаться в таблице с серым бейджем
