-- Миграция 040: Создание таблицы материалов нарядов (расход)
-- Дата: 2024-12-12

-- Таблица расхода материалов на наряд
CREATE TABLE IF NOT EXISTS zakaz_work_order_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Связь с нарядом
    work_order_id UUID NOT NULL REFERENCES zakaz_work_orders(id) ON DELETE CASCADE,

    -- Связь со справочником материалов (NULL если свободный ввод)
    material_id UUID REFERENCES zakaz_materials(id) ON DELETE SET NULL,

    -- Наименование материала (для свободного ввода или копия из справочника)
    material_name TEXT NOT NULL,

    -- Единица измерения
    unit TEXT NOT NULL,

    -- Количество (расход)
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Примечания
    notes TEXT,

    -- Дата добавления
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для поиска по наряду
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_materials_work_order ON zakaz_work_order_materials(work_order_id);

-- Индекс для связи со справочником
CREATE INDEX IF NOT EXISTS idx_zakaz_work_order_materials_material ON zakaz_work_order_materials(material_id)
    WHERE material_id IS NOT NULL;

-- Комментарии к таблице
COMMENT ON TABLE zakaz_work_order_materials IS 'Расход материалов по наряду';
COMMENT ON COLUMN zakaz_work_order_materials.work_order_id IS 'Ссылка на наряд';
COMMENT ON COLUMN zakaz_work_order_materials.material_id IS 'Ссылка на справочник материалов (NULL для свободного ввода)';
COMMENT ON COLUMN zakaz_work_order_materials.material_name IS 'Наименование материала';
COMMENT ON COLUMN zakaz_work_order_materials.unit IS 'Единица измерения';
COMMENT ON COLUMN zakaz_work_order_materials.quantity IS 'Количество (расход)';
COMMENT ON COLUMN zakaz_work_order_materials.notes IS 'Примечания';
