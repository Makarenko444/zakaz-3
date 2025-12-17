-- Миграция 052: Добавление новых значений в enum zakaz_service_type
-- Дата: 2025-12-17
-- Описание: Добавляем новые типы работ в enum zakaz_service_type

-- ВАЖНО: Эту миграцию нужно выполнять НЕ внутри транзакции!
-- Выполните команды по одной или с параметром -1 (single transaction off)
-- psql -f 052_add_service_type_enum_values.sql -1

-- Добавляем новые значения в enum zakaz_service_type
-- IF NOT EXISTS игнорирует ошибку если значение уже есть (PostgreSQL 9.3+)

ALTER TYPE zakaz_service_type ADD VALUE IF NOT EXISTS 'access_control';
ALTER TYPE zakaz_service_type ADD VALUE IF NOT EXISTS 'node_construction';
ALTER TYPE zakaz_service_type ADD VALUE IF NOT EXISTS 'trunk_construction';
ALTER TYPE zakaz_service_type ADD VALUE IF NOT EXISTS 'video_surveillance';
