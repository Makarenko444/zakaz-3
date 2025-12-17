-- Добавление складов, остатков по складам и уровня активности материалов

-- 1. Таблица складов
CREATE TABLE IF NOT EXISTS zakaz_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Таблица остатков материалов по складам
CREATE TABLE IF NOT EXISTS zakaz_warehouse_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES zakaz_warehouses(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES zakaz_materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 3) DEFAULT 0,
    last_import_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(warehouse_id, material_id)
);

-- 3. Добавляем уровень активности в материалы (1-4)
-- 1 = очень популярный, 2 = иногда, 3 = редко, 4 = архив
ALTER TABLE zakaz_materials
ADD COLUMN IF NOT EXISTS activity_level INTEGER DEFAULT 2;

-- Устанавливаем activity_level на основе is_active
UPDATE zakaz_materials SET activity_level = CASE
    WHEN is_active = true THEN 2
    ELSE 4
END WHERE activity_level IS NULL;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_warehouses_active ON zakaz_warehouses(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_warehouse ON zakaz_warehouse_stocks(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_stocks_material ON zakaz_warehouse_stocks(material_id);
CREATE INDEX IF NOT EXISTS idx_materials_activity_level ON zakaz_materials(activity_level);

-- Права доступа
GRANT ALL ON zakaz_warehouses TO anon, authenticated, service_role;
GRANT ALL ON zakaz_warehouse_stocks TO anon, authenticated, service_role;

-- Предзаполнение базовых складов
INSERT INTO zakaz_warehouses (name, code, sort_order) VALUES
('Основной склад', 'MAIN', 1),
('Склад монтажников', 'INSTALL', 2),
('Резервный склад', 'RESERVE', 3)
ON CONFLICT (code) DO NOTHING;
