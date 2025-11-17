# Инструкция по применению миграции 011

## Что изменилось

Миграция `011_refactor_address_fields.sql` вносит изменения в структуру работы с адресами:

### Изменения в базе данных

1. **Таблица `zakaz_applications` (заявки)**
   - Добавлено поле `freeform_address` TEXT - адрес в свободной форме
   - Добавлено поле `entrance` TEXT - подъезд
   - Добавлено поле `floor` TEXT - этаж
   - Добавлено поле `apartment` TEXT - квартира
   - Поле `address_id` теперь необязательное (nullable)

2. **Таблица `zakaz_addresses` (справочник адресов)**
   - Удалено поле `entrance` (данные автоматически перенесены в `zakaz_applications`)
   - Теперь справочник содержит только базовый адрес: улица + дом

### Миграция данных

При применении миграции:
- Все существующие данные из поля `entrance` таблицы `zakaz_addresses` будут автоматически скопированы в поле `entrance` таблицы `zakaz_applications`
- Данные не будут потеряны

## Как применить миграцию

### Через Supabase SQL Editor

1. Откройте Supabase Dashboard
2. Перейдите в раздел SQL Editor
3. Создайте новый запрос
4. Скопируйте содержимое файла `011_refactor_address_fields.sql`
5. Выполните запрос
6. Проверьте, что миграция прошла успешно

### Через psql

```bash
psql -h <your-host> -U <your-user> -d <your-database> -f database/migrations/011_refactor_address_fields.sql
```

## Проверка после миграции

После применения миграции проверьте:

```sql
-- Проверка новых полей в zakaz_applications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'zakaz_applications'
  AND column_name IN ('freeform_address', 'entrance', 'floor', 'apartment', 'address_id');

-- Проверка что entrance удален из zakaz_addresses
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zakaz_addresses'
  AND column_name = 'entrance';
-- Должен вернуть пустой результат

-- Проверка что данные перенесены
SELECT COUNT(*) as migrated_count
FROM zakaz_applications
WHERE entrance IS NOT NULL;
```

## Новые возможности

После применения миграции и развертывания кода:

### 1. Создание заявки с адресом в свободной форме
Теперь при создании заявки можно:
- Ввести адрес вручную в текстовое поле
- Выбрать адрес из справочника и указать дополнительные данные (подъезд, этаж, квартира)

### 2. Работа с адресами в заявке
- Адрес в свободной форме отображается в выделенном блоке при редактировании
- Можно переключиться на выбор из справочника
- Кнопка для добавления адреса в справочник (пока только подсказка)

### 3. Два типа хранения адреса
- **Поле 1**: Улица + дом (хранится в справочнике `zakaz_addresses`)
- **Поле 2**: Дополнительные данные - подъезд, этаж, квартира (хранится только в заявке `zakaz_applications`)

## Откат миграции (если потребуется)

Если нужно откатить миграцию:

```sql
-- ВНИМАНИЕ: Это приведет к потере данных в полях freeform_address, floor, apartment
-- Данные из entrance будут сохранены при переносе обратно

-- Восстанавливаем entrance в zakaz_addresses
ALTER TABLE zakaz_addresses
  ADD COLUMN entrance TEXT;

-- Переносим данные обратно (ТОЛЬКО для адресов из справочника)
UPDATE zakaz_addresses addr
SET entrance = app.entrance
FROM (
  SELECT DISTINCT ON (address_id) address_id, entrance
  FROM zakaz_applications
  WHERE address_id IS NOT NULL AND entrance IS NOT NULL
  ORDER BY address_id, created_at DESC
) app
WHERE addr.id = app.address_id;

-- Делаем address_id обязательным снова (ОПАСНО: может вызвать ошибки если есть заявки без address_id)
-- ALTER TABLE zakaz_applications ALTER COLUMN address_id SET NOT NULL;

-- Удаляем новые поля
ALTER TABLE zakaz_applications
  DROP COLUMN freeform_address,
  DROP COLUMN entrance,
  DROP COLUMN floor,
  DROP COLUMN apartment;
```

## Поддержка

При возникновении проблем с миграцией создайте issue в репозитории проекта.
