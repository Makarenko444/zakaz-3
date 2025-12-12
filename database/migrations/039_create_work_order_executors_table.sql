-- Миграция 039: Создание таблицы исполнителей нарядов
-- Дата: 2024-12-12

-- Таблица исполнителей наряда
CREATE TABLE IF NOT EXISTS zakaz_work_order_executors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Связь с нарядом
    work_order_id UUID NOT NULL REFERENCES zakaz_work_orders(id) ON DELETE CASCADE,

    -- Связь с пользователем (исполнителем)
    user_id UUID NOT NULL REFERENCES zakaz_users(id) ON DELETE CASCADE,

    -- Флаг бригадира (старший в группе)
    is_lead BOOLEAN NOT NULL DEFAULT FALSE,

    -- Дата добавления
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Уникальность: один пользователь не может быть дважды назначен на один наряд
    CONSTRAINT unique_executor_per_work_order UNIQUE (work_order_id, user_id)
);

-- Индекс для поиска по наряду
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_executors_work_order ON zakaz_work_order_executors(work_order_id);

-- Индекс для поиска нарядов пользователя
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_executors_user ON zakaz_work_order_executors(user_id);

-- Индекс для поиска бригадиров
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_executors_lead ON zakaz_work_order_executors(work_order_id) WHERE is_lead = TRUE;

-- Комментарии к таблице
COMMENT ON TABLE zakaz_work_order_executors IS 'Исполнители нарядов (связь многие-ко-многим)';
COMMENT ON COLUMN zakaz_work_order_executors.work_order_id IS 'Ссылка на наряд';
COMMENT ON COLUMN zakaz_work_order_executors.user_id IS 'Ссылка на пользователя-исполнителя';
COMMENT ON COLUMN zakaz_work_order_executors.is_lead IS 'Является ли бригадиром (старшим)';
