-- Миграция 045: Добавление полей для импорта материалов из 1С
-- Дата: 2025-12-16
-- Описание:
--   Добавляем поля для синхронизации с 1С:
--   - code (уникальный код материала из 1С)
--   - price (цена за единицу)
--   - stock_quantity (остаток на складе)
--   - last_import_at (дата последнего импорта)

-- Добавляем код материала (уникальный идентификатор из 1С)
ALTER TABLE zakaz_materials ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- Добавляем цену за единицу
ALTER TABLE zakaz_materials ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2) DEFAULT 0;

-- Добавляем остаток на складе
ALTER TABLE zakaz_materials ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(12, 3) DEFAULT 0;

-- Добавляем дату последнего импорта
ALTER TABLE zakaz_materials ADD COLUMN IF NOT EXISTS last_import_at TIMESTAMPTZ;

-- Создаем уникальный индекс по коду (для upsert при импорте)
CREATE UNIQUE INDEX IF NOT EXISTS idx_zakaz_materials_code ON zakaz_materials(code) WHERE code IS NOT NULL;

-- Создаем индекс для поиска по названию (полнотекстовый)
CREATE INDEX IF NOT EXISTS idx_zakaz_materials_name_search ON zakaz_materials USING gin(to_tsvector('russian', name));

-- Комментарии к новым полям
COMMENT ON COLUMN zakaz_materials.code IS 'Уникальный код материала из 1С';
COMMENT ON COLUMN zakaz_materials.price IS 'Цена за единицу измерения';
COMMENT ON COLUMN zakaz_materials.stock_quantity IS 'Остаток на складе';
COMMENT ON COLUMN zakaz_materials.last_import_at IS 'Дата последнего импорта из 1С';

-- Предоставляем права доступа
GRANT ALL ON zakaz_materials TO authenticator;
GRANT ALL ON zakaz_materials TO service_role;
