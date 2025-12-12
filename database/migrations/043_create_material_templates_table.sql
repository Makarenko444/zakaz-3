-- Таблица шаблонов материалов
-- Содержит наборы материалов для типовых задач

-- Таблица шаблонов
CREATE TABLE IF NOT EXISTS zakaz_material_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица позиций шаблона (материалы в шаблоне)
CREATE TABLE IF NOT EXISTS zakaz_material_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES zakaz_material_templates(id) ON DELETE CASCADE,
    material_id UUID REFERENCES zakaz_materials(id) ON DELETE SET NULL,
    material_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'шт',
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_material_templates_active ON zakaz_material_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_material_template_items_template ON zakaz_material_template_items(template_id);

-- Права доступа
GRANT ALL ON zakaz_material_templates TO anon, authenticated, service_role;
GRANT ALL ON zakaz_material_template_items TO anon, authenticated, service_role;

-- Предзаполнение базовых шаблонов
INSERT INTO zakaz_material_templates (name, description, sort_order) VALUES
('Подключение квартиры', 'Стандартный набор для подключения квартиры', 1),
('Подключение офиса', 'Набор материалов для подключения офиса', 2),
('Монтаж узла связи', 'Материалы для монтажа узла связи', 3),
('Монтаж оптики', 'Материалы для прокладки оптоволокна', 4),
('Аварийный ремонт', 'Минимальный набор для аварийного ремонта', 5);
