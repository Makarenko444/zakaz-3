-- Разрешаем NULL в колонке quantity для позиций шаблона
-- Это позволяет добавлять материал без указания количества

ALTER TABLE zakaz_material_template_items
ALTER COLUMN quantity DROP NOT NULL;

-- Убираем дефолтное значение, чтобы NULL был явным
ALTER TABLE zakaz_material_template_items
ALTER COLUMN quantity DROP DEFAULT;
