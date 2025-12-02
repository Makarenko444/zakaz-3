-- Миграция 029: Добавление статуса присутствия в таблицу адресов
-- Дата: 2025-12-02
-- Описание:
--   1. Создаем ENUM тип для статусов присутствия на адресе
--   2. Добавляем поле presence_status в zakaz_addresses
--   3. Заполняем поле для существующих адресов на основе узлов (одноразово)

-- =====================================================
-- ЭТАП 1: Создание типа address_presence_status
-- =====================================================

CREATE TYPE address_presence_status AS ENUM (
  'has_node',              -- Есть узел
  'has_ao',                -- Есть АО (абонентское окончание)
  'has_transit_cable',     -- Есть транзитный кабель
  'collecting_collective', -- Собираем коллективную заявку
  'not_present'            -- Не присутствуем
);

COMMENT ON TYPE address_presence_status IS 'Статус присутствия компании на адресе (редактируется вручную)';

-- =====================================================
-- ЭТАП 2: Добавление поля в zakaz_addresses
-- =====================================================

ALTER TABLE zakaz_addresses
  ADD COLUMN presence_status address_presence_status DEFAULT 'not_present' NOT NULL;

COMMENT ON COLUMN zakaz_addresses.presence_status IS
  'Статус присутствия на адресе (редактируется администратором вручную)';

-- Создаем индекс для быстрой фильтрации по статусу
CREATE INDEX idx_addresses_presence_status ON zakaz_addresses(presence_status);

-- =====================================================
-- ЭТАП 3: Заполнение данных для существующих адресов
-- =====================================================

-- Обновляем статус для адресов на основе привязанных узлов (одноразово)
-- Логика приоритета:
--   1. Если есть хотя бы 1 узел с presence_type='has_node' → 'has_node'
--   2. Иначе если есть узел с 'has_ao' → 'has_ao'
--   3. Иначе если есть узел с 'has_transit_cable' → 'has_transit_cable'
--   4. Иначе → 'not_present' (уже установлено по умолчанию)

-- Шаг 3.1: Адреса с узлами типа 'has_node'
UPDATE zakaz_addresses addr
SET presence_status = 'has_node'
WHERE EXISTS (
  SELECT 1 FROM zakaz_nodes n
  WHERE n.address_id = addr.id
  AND n.presence_type = 'has_node'
);

-- Шаг 3.2: Адреса с узлами типа 'has_ao' (если еще не обновлены)
UPDATE zakaz_addresses addr
SET presence_status = 'has_ao'
WHERE presence_status = 'not_present'
AND EXISTS (
  SELECT 1 FROM zakaz_nodes n
  WHERE n.address_id = addr.id
  AND n.presence_type = 'has_ao'
);

-- Шаг 3.3: Адреса с узлами типа 'has_transit_cable' (если еще не обновлены)
UPDATE zakaz_addresses addr
SET presence_status = 'has_transit_cable'
WHERE presence_status = 'not_present'
AND EXISTS (
  SELECT 1 FROM zakaz_nodes n
  WHERE n.address_id = addr.id
  AND n.presence_type = 'has_transit_cable'
);

-- =====================================================
-- ЭТАП 4: Проверка результатов
-- =====================================================

-- Выводим статистику по статусам присутствия
DO $$
DECLARE
  total_count INTEGER;
  has_node_count INTEGER;
  has_ao_count INTEGER;
  has_transit_count INTEGER;
  collecting_count INTEGER;
  not_present_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM zakaz_addresses;
  SELECT COUNT(*) INTO has_node_count FROM zakaz_addresses WHERE presence_status = 'has_node';
  SELECT COUNT(*) INTO has_ao_count FROM zakaz_addresses WHERE presence_status = 'has_ao';
  SELECT COUNT(*) INTO has_transit_count FROM zakaz_addresses WHERE presence_status = 'has_transit_cable';
  SELECT COUNT(*) INTO collecting_count FROM zakaz_addresses WHERE presence_status = 'collecting_collective';
  SELECT COUNT(*) INTO not_present_count FROM zakaz_addresses WHERE presence_status = 'not_present';

  RAISE NOTICE '=== Статистика по статусам присутствия ===';
  RAISE NOTICE 'Всего адресов: %', total_count;
  RAISE NOTICE 'Есть узел: %', has_node_count;
  RAISE NOTICE 'Есть АО: %', has_ao_count;
  RAISE NOTICE 'Есть транзитный кабель: %', has_transit_count;
  RAISE NOTICE 'Собираем коллективную заявку: %', collecting_count;
  RAISE NOTICE 'Не присутствуем: %', not_present_count;
END $$;

-- =====================================================
-- ОТКАТ МИГРАЦИИ (если потребуется)
-- =====================================================

-- Для отката выполнить:
-- DROP INDEX IF EXISTS idx_addresses_presence_status;
-- ALTER TABLE zakaz_addresses DROP COLUMN presence_status;
-- DROP TYPE address_presence_status;
