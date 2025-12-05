-- Миграция 030: Добавление полей для импорта данных из старой системы (zakaz_all)
-- Дата: 2025-12-05
-- Описание: Добавляет legacy-поля для хранения ID и данных из старой Drupal-системы

-- ============================================================================
-- 1. ТАБЛИЦА zakaz_applications - добавляем поля для старых заявок
-- ============================================================================

-- legacy_id - ID заявки из старой системы (node.nid)
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS legacy_id BIGINT;

-- legacy_stage - оригинальный этап из старой системы (для истории)
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS legacy_stage TEXT;

-- Индекс для поиска по legacy_id
CREATE INDEX IF NOT EXISTS idx_zakaz_applications_legacy_id
ON zakaz_applications(legacy_id)
WHERE legacy_id IS NOT NULL;

-- Уникальность legacy_id (одна старая заявка = одна новая)
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakaz_applications_legacy_id_unique
ON zakaz_applications(legacy_id)
WHERE legacy_id IS NOT NULL;

COMMENT ON COLUMN zakaz_applications.legacy_id IS 'ID заявки из старой системы Drupal (node.nid). NULL для новых заявок.';
COMMENT ON COLUMN zakaz_applications.legacy_stage IS 'Оригинальный этап заявки из старой системы (например: "6. Очередь на монтаж"). Сохраняется для истории.';

-- ============================================================================
-- 2. ТАБЛИЦА zakaz_application_comments - добавляем legacy_id
-- ============================================================================

-- legacy_id - ID комментария из старой системы (comments.cid)
ALTER TABLE zakaz_application_comments
ADD COLUMN IF NOT EXISTS legacy_id BIGINT;

-- Индекс для поиска и дедупликации
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakaz_application_comments_legacy_id_unique
ON zakaz_application_comments(legacy_id)
WHERE legacy_id IS NOT NULL;

COMMENT ON COLUMN zakaz_application_comments.legacy_id IS 'ID комментария из старой системы Drupal (comments.cid). NULL для новых комментариев.';

-- ============================================================================
-- 3. ТАБЛИЦА zakaz_files - добавляем legacy-поля и делаем uploaded_by nullable
-- ============================================================================

-- legacy_id - ID файла из старой системы (files.fid)
ALTER TABLE zakaz_files
ADD COLUMN IF NOT EXISTS legacy_id BIGINT;

-- legacy_path - путь к файлу в старой системе (для миграции файлов)
ALTER TABLE zakaz_files
ADD COLUMN IF NOT EXISTS legacy_path TEXT;

-- Делаем uploaded_by nullable для legacy-записей
ALTER TABLE zakaz_files
ALTER COLUMN uploaded_by DROP NOT NULL;

-- Индекс для поиска по legacy_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakaz_files_legacy_id_unique
ON zakaz_files(legacy_id)
WHERE legacy_id IS NOT NULL;

COMMENT ON COLUMN zakaz_files.legacy_id IS 'ID файла из старой системы Drupal (files.fid). NULL для новых файлов.';
COMMENT ON COLUMN zakaz_files.legacy_path IS 'Путь к файлу в старой системе (например: sites/default/files/passport.jpg). Используется для миграции файлов.';

-- ============================================================================
-- 4. ПЕРЕНУМЕРАЦИЯ ТЕКУЩИХ ЗАЯВОК (100001+) для освобождения номеров под legacy
-- ============================================================================

-- Обновляем существующие номера заявок, сдвигая их на 100000
UPDATE zakaz_applications
SET application_number = application_number + 100000
WHERE legacy_id IS NULL;

-- Обновляем sequence чтобы новые заявки получали номера после максимального
SELECT setval(
  'zakaz_applications_number_seq',
  GREATEST(
    (SELECT COALESCE(MAX(application_number), 0) FROM zakaz_applications),
    100000
  )
);

-- ============================================================================
-- ДОКУМЕНТАЦИЯ: Маппинг старых этапов (stage) на новые статусы (status)
-- ============================================================================
/*
Маппинг для импорта из старой системы zakaz_all:

| Старый stage                | Новый status    | urgency  | Примечание                    |
|-----------------------------|-----------------|----------|-------------------------------|
| 1. Новая заявка             | new             | normal   |                               |
| 1.1. Собираем группу        | no_tech         | normal   | Коллективная заявка           |
| 1.2. Аварийная заявка       | new             | critical | Срочность critical            |
| 1.3. Заказчик думает        | thinking        | normal   |                               |
| 1.4. Потенциальный клиент   | thinking        | normal   |                               |
| 1.5. Переоформление договора| contract        | normal   |                               |
| 2. Расчет стоимости         | estimation      | normal   |                               |
| 2.1. Расчет выполнен        | estimation      | normal   |                               |
| 3. Заключение договора      | contract        | normal   |                               |
| 4. Ждем оплату              | contract        | normal   |                               |
| 5. Проектирование           | design          | normal   |                               |
| 5.1. Согласование           | approval        | normal   |                               |
| 6. Очередь на монтаж        | queue_install   | normal   |                               |
| 7. Монтаж                   | install         | normal   |                               |
| 8. Пусконаладка             | install         | normal   | Часть монтажа                 |
| 9. Выполнена                | installed       | normal   |                               |
| 10. Отказ                   | rejected        | normal   |                               |
| 11. Нет техн. возможности   | no_tech         | normal   |                               |
| 12. Дубль заявки            | rejected        | normal   | Дубликат                      |

Маппинг типов подключения (type -> service_type):
| Старый type              | Новый service_type |
|--------------------------|--------------------|
| Домашнее подключение     | apartment          |
| Офисное подключение      | office             |
| СКС                      | scs                |
| (другое)                 | apartment          | -- default

Маппинг клиентов:
- Если есть company -> customer_type = 'business', customer_fullname = company, contact_person = client_fio
- Если только client_fio -> customer_type = 'individual', customer_fullname = client_fio
*/
