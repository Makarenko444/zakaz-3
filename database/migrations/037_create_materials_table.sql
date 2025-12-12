-- Миграция 037: Создание справочника материалов
-- Дата: 2024-12-12

-- Таблица справочника материалов
CREATE TABLE IF NOT EXISTS zakaz_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    unit TEXT NOT NULL, -- единица измерения: м, шт, уп
    category TEXT, -- категория: кабель, разъём, крепёж и т.д.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для сортировки
CREATE INDEX IF NOT EXISTS idx_zakaz_materials_sort ON zakaz_materials(sort_order, name);

-- Индекс для фильтрации по категории
CREATE INDEX IF NOT EXISTS idx_zakaz_materials_category ON zakaz_materials(category) WHERE category IS NOT NULL;

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_zakaz_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_zakaz_materials_updated_at
    BEFORE UPDATE ON zakaz_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_zakaz_materials_updated_at();

-- Начальные данные: 14 базовых материалов
INSERT INTO zakaz_materials (name, unit, category, sort_order) VALUES
    ('Кабель витая пара медный внутренний UTP кат. 5е 4 жилы', 'м', 'кабель', 1),
    ('Кабель витая пара медный внутренний UTP кат. 5е 8 жил', 'м', 'кабель', 2),
    ('Кабель витая пара медный наружный кат. 5е 8 жил', 'м', 'кабель', 3),
    ('Розетка витопарная (RJ45) одинарная', 'шт', 'разъём', 4),
    ('Модуль Keystone RJ45 кат. 5е', 'шт', 'разъём', 5),
    ('Шнур соединительный медный RJ45 UTP 1 м', 'шт', 'разъём', 6),
    ('Вилка RJ45', 'шт', 'разъём', 7),
    ('Колпачок защитный для вилки RJ45', 'шт', 'разъём', 8),
    ('Кабельный канал 16х16', 'м', 'короб', 9),
    ('Саморез по дереву 3,5х45', 'шт', 'крепёж', 10),
    ('Дюбель распорный 6х40', 'шт', 'крепёж', 11),
    ('Скоба 4мм', 'уп', 'крепёж', 12),
    ('Скоба 5мм', 'уп', 'крепёж', 13),
    ('Стяжка 150х3,6', 'уп', 'крепёж', 14);

-- Комментарии к таблице
COMMENT ON TABLE zakaz_materials IS 'Справочник материалов для монтажных работ';
COMMENT ON COLUMN zakaz_materials.name IS 'Наименование материала';
COMMENT ON COLUMN zakaz_materials.unit IS 'Единица измерения (м, шт, уп)';
COMMENT ON COLUMN zakaz_materials.category IS 'Категория материала';
COMMENT ON COLUMN zakaz_materials.is_active IS 'Активен ли материал в справочнике';
COMMENT ON COLUMN zakaz_materials.sort_order IS 'Порядок сортировки';
