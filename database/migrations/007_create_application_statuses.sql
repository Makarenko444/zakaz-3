-- Таблица справочника статусов заявок
CREATE TABLE IF NOT EXISTS zakaz_application_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Код статуса (используется в коде)
    code VARCHAR(50) NOT NULL UNIQUE,

    -- Русское название для отображения
    name_ru TEXT NOT NULL,

    -- Описание статуса (опционально)
    description_ru TEXT,

    -- Порядок сортировки для отображения в списках
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Активен ли статус
    is_active BOOLEAN DEFAULT TRUE,

    -- Временные метки
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_application_statuses_code ON zakaz_application_statuses(code);
CREATE INDEX IF NOT EXISTS idx_application_statuses_sort_order ON zakaz_application_statuses(sort_order);
CREATE INDEX IF NOT EXISTS idx_application_statuses_is_active ON zakaz_application_statuses(is_active);

-- Комментарии к таблице
COMMENT ON TABLE zakaz_application_statuses IS 'Справочник статусов заявок';
COMMENT ON COLUMN zakaz_application_statuses.code IS 'Код статуса на английском (используется в коде)';
COMMENT ON COLUMN zakaz_application_statuses.name_ru IS 'Русское название статуса для отображения';
COMMENT ON COLUMN zakaz_application_statuses.sort_order IS 'Порядок сортировки для отображения в списках';

-- Права доступа
GRANT SELECT, INSERT, UPDATE, DELETE ON zakaz_application_statuses TO service_role;
GRANT SELECT ON zakaz_application_statuses TO authenticated;

-- Триггер для обновления updated_at
CREATE TRIGGER update_zakaz_application_statuses_updated_at
    BEFORE UPDATE ON zakaz_application_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Заполнение справочника статусов
INSERT INTO zakaz_application_statuses (code, name_ru, description_ru, sort_order) VALUES
    ('new', 'Новая', 'Новая заявка, ожидает обработки', 1),
    ('thinking', 'Думает', 'Заявка на рассмотрении', 2),
    ('estimation', 'Расчёт', 'Производится расчёт стоимости', 3),
    ('waiting_payment', 'Ожидание оплаты', 'Ожидается оплата от клиента', 4),
    ('contract', 'Договор', 'Заключение договора', 5),
    ('queue_install', 'Очередь на монтаж', 'Заявка в очереди на выполнение монтажных работ', 6),
    ('install', 'Монтаж', 'Выполняются монтажные работы', 7),
    ('installed', 'Выполнено', 'Работы выполнены', 8),
    ('rejected', 'Отказ', 'Заявка отклонена', 9),
    ('no_tech', 'Нет тех. возможности', 'Отсутствует техническая возможность выполнения', 10)
ON CONFLICT (code) DO NOTHING;
