-- Добавление поля updated_by в таблицу zakaz_applications
-- Миграция 015: Добавление отслеживания пользователя, обновившего заявку

-- Добавляем поле updated_by
ALTER TABLE zakaz_applications
ADD COLUMN updated_by UUID REFERENCES zakaz_users(id) ON DELETE SET NULL;

-- Создаем индекс для поля updated_by
CREATE INDEX idx_zakaz_applications_updated_by ON zakaz_applications(updated_by);

-- Комментарий к полю
COMMENT ON COLUMN zakaz_applications.updated_by IS 'ID пользователя, последним обновившего заявку';
