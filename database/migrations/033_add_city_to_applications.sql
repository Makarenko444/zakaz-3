-- Миграция 033: Добавление поля city в таблицу заявок
-- Дата: 2025-12-09
-- Описание: Добавляет поле города в заявки для более точной адресации

-- 1. Добавляем поле city с дефолтным значением "Томск"
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT 'Томск';

-- 2. Комментарий к полю
COMMENT ON COLUMN zakaz_applications.city IS 'Город (по умолчанию Томск)';

-- 3. Индекс для поиска по городу
CREATE INDEX IF NOT EXISTS idx_applications_city ON zakaz_applications(city);

-- Проверка результата
SELECT
  'Поле city добавлено' as status,
  COUNT(*) as total_applications,
  COUNT(city) as with_city
FROM zakaz_applications;
