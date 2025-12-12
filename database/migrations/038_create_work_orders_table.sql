-- Миграция 038: Создание таблицы нарядов (work orders)
-- Дата: 2024-12-12

-- Создаём enum для типа наряда
DO $$ BEGIN
    CREATE TYPE work_order_type AS ENUM ('survey', 'installation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Создаём enum для статуса наряда
DO $$ BEGIN
    CREATE TYPE work_order_status AS ENUM ('draft', 'assigned', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Таблица нарядов
CREATE TABLE IF NOT EXISTS zakaz_work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Номер наряда (автоинкремент)
    work_order_number SERIAL NOT NULL,

    -- Связь с заявкой
    application_id UUID NOT NULL REFERENCES zakaz_applications(id) ON DELETE CASCADE,

    -- Тип и статус
    type work_order_type NOT NULL,
    status work_order_status NOT NULL DEFAULT 'draft',

    -- Планирование
    scheduled_date DATE, -- дата выполнения
    scheduled_time TIME, -- время начала
    estimated_duration INTERVAL, -- ориентировочная продолжительность (например '4 hours')

    -- Фактическое выполнение
    actual_start_at TIMESTAMPTZ, -- фактическое начало
    actual_end_at TIMESTAMPTZ, -- фактическое окончание

    -- Примечания
    notes TEXT, -- примечания при выдаче наряда
    result_notes TEXT, -- результат/комментарий по выполнению

    -- Подпись клиента
    customer_signature BOOLEAN NOT NULL DEFAULT FALSE,

    -- Аудит
    created_by UUID REFERENCES zakaz_users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES zakaz_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Уникальный индекс для номера наряда
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakaz_work_orders_number ON zakaz_work_orders(work_order_number);

-- Индекс для связи с заявкой
CREATE INDEX IF NOT EXISTS idx_zakaz_work_orders_application ON zakaz_work_orders(application_id);

-- Индекс для фильтрации по типу и статусу
CREATE INDEX IF NOT EXISTS idx_zakaz_work_orders_type_status ON zakaz_work_orders(type, status);

-- Индекс для календаря (дата + статус)
CREATE INDEX IF NOT EXISTS idx_zakaz_work_orders_schedule ON zakaz_work_orders(scheduled_date, status)
    WHERE scheduled_date IS NOT NULL;

-- Индекс для поиска по дате создания
CREATE INDEX IF NOT EXISTS idx_zakaz_work_orders_created ON zakaz_work_orders(created_at DESC);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_zakaz_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_zakaz_work_orders_updated_at
    BEFORE UPDATE ON zakaz_work_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_zakaz_work_orders_updated_at();

-- Комментарии к таблице
COMMENT ON TABLE zakaz_work_orders IS 'Наряды на выполнение работ';
COMMENT ON COLUMN zakaz_work_orders.work_order_number IS 'Уникальный номер наряда';
COMMENT ON COLUMN zakaz_work_orders.application_id IS 'Ссылка на заявку';
COMMENT ON COLUMN zakaz_work_orders.type IS 'Тип наряда: survey (осмотр и расчёт), installation (монтаж)';
COMMENT ON COLUMN zakaz_work_orders.status IS 'Статус: draft, assigned, in_progress, completed, cancelled';
COMMENT ON COLUMN zakaz_work_orders.scheduled_date IS 'Запланированная дата выполнения';
COMMENT ON COLUMN zakaz_work_orders.scheduled_time IS 'Запланированное время начала';
COMMENT ON COLUMN zakaz_work_orders.estimated_duration IS 'Ориентировочная продолжительность работ';
COMMENT ON COLUMN zakaz_work_orders.actual_start_at IS 'Фактическое время начала работ';
COMMENT ON COLUMN zakaz_work_orders.actual_end_at IS 'Фактическое время окончания работ';
COMMENT ON COLUMN zakaz_work_orders.notes IS 'Примечания при выдаче наряда';
COMMENT ON COLUMN zakaz_work_orders.result_notes IS 'Результат и комментарии по выполнению';
COMMENT ON COLUMN zakaz_work_orders.customer_signature IS 'Получена ли подпись клиента';
