-- Миграция 048: Добавление поля "Технический куратор" в заявки
-- Дата: 2025-12-17
-- Описание: Добавляет поле technical_curator_id для привязки технического куратора к заявке

-- Добавляем поле technical_curator_id
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS technical_curator_id UUID REFERENCES zakaz_users(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска заявок по техническому куратору
CREATE INDEX IF NOT EXISTS idx_zakaz_applications_technical_curator_id
ON zakaz_applications(technical_curator_id);

-- Комментарий к полю
COMMENT ON COLUMN zakaz_applications.technical_curator_id IS 'Технический куратор заявки (ссылка на пользователя)';
