-- Миграция 049: Добавление поля work_type (тип работ) в таблицу заявок
-- Дата: 2025-12-17

-- Создаём enum тип для типов работ
DO $$ BEGIN
    CREATE TYPE work_type_enum AS ENUM (
        'access_control',      -- СКУД
        'node_construction',   -- Строительство Узла
        'trunk_construction'   -- Строительство магистрали
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Добавляем поле work_type в таблицу заявок
-- Поле nullable, так как не все заявки имеют тип работ
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS work_type work_type_enum DEFAULT NULL;

-- Комментарий к полю
COMMENT ON COLUMN zakaz_applications.work_type IS 'Тип работ: access_control (СКУД), node_construction (Строительство Узла), trunk_construction (Строительство магистрали)';

-- Индекс для быстрой фильтрации по типу работ
CREATE INDEX IF NOT EXISTS idx_zakaz_applications_work_type ON zakaz_applications(work_type);
