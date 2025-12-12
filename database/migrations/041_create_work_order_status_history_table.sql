-- Миграция 041: Создание таблицы истории статусов нарядов
-- Дата: 2024-12-12

-- Таблица истории статусов наряда
CREATE TABLE IF NOT EXISTS zakaz_work_order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Связь с нарядом
    work_order_id UUID NOT NULL REFERENCES zakaz_work_orders(id) ON DELETE CASCADE,

    -- Старый и новый статус
    old_status work_order_status,
    new_status work_order_status NOT NULL,

    -- Кто изменил
    changed_by UUID REFERENCES zakaz_users(id) ON DELETE SET NULL,

    -- Комментарий при смене статуса
    comment TEXT,

    -- Когда изменено
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для поиска по наряду
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_status_history_work_order ON zakaz_work_order_status_history(work_order_id);

-- Индекс для поиска по дате
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_status_history_date ON zakaz_work_order_status_history(changed_at DESC);

-- Комментарии к таблице
COMMENT ON TABLE zakaz_work_order_status_history IS 'История изменения статусов нарядов';
COMMENT ON COLUMN zakaz_work_order_status_history.work_order_id IS 'Ссылка на наряд';
COMMENT ON COLUMN zakaz_work_order_status_history.old_status IS 'Предыдущий статус (NULL при создании)';
COMMENT ON COLUMN zakaz_work_order_status_history.new_status IS 'Новый статус';
COMMENT ON COLUMN zakaz_work_order_status_history.changed_by IS 'Кто изменил статус';
COMMENT ON COLUMN zakaz_work_order_status_history.comment IS 'Комментарий при смене статуса';
