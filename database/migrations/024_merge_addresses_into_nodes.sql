-- Миграция 024: Объединение таблиц адресов и узлов связи
-- Дата: 2025-11-24
-- Описание:
--   1. Объединяем zakaz_addresses и zakaz_nodes в единую таблицу zakaz_nodes
--   2. Добавляем поле presence_type для обозначения типа присутствия на адресе
--   3. Переносим все данные из zakaz_addresses в zakaz_nodes
--   4. Обновляем ссылки в zakaz_applications
--   5. Удаляем таблицу zakaz_addresses

-- =====================================================
-- ЭТАП 1: Создание типа presence_type
-- =====================================================

CREATE TYPE presence_type AS ENUM (
  'has_node',           -- Есть узел (ПП, активное оборудование)
  'has_ao',             -- Есть АО (автономный объект)
  'has_transit_cable',  -- Есть транзитный кабель
  'not_present'         -- Не присутствуем на данном адресе
);

COMMENT ON TYPE presence_type IS 'Тип присутствия компании на данном адресе';

-- =====================================================
-- ЭТАП 2: Добавление новых полей в zakaz_nodes
-- =====================================================

-- Добавляем структурированные поля адреса
ALTER TABLE zakaz_nodes
  ADD COLUMN street VARCHAR(500),     -- Улица
  ADD COLUMN house VARCHAR(50),       -- Номер дома
  ADD COLUMN comment TEXT,            -- Комментарий к адресу
  ADD COLUMN presence_type presence_type DEFAULT 'has_node' NOT NULL;

-- Добавляем комментарии
COMMENT ON COLUMN zakaz_nodes.street IS 'Название улицы (структурированное поле)';
COMMENT ON COLUMN zakaz_nodes.house IS 'Номер дома (структурированное поле)';
COMMENT ON COLUMN zakaz_nodes.comment IS 'Комментарий к адресу';
COMMENT ON COLUMN zakaz_nodes.presence_type IS 'Тип присутствия компании на адресе';

-- =====================================================
-- ЭТАП 3: Обновление существующих узлов
-- =====================================================

-- Устанавливаем presence_type для существующих узлов на основе node_type
UPDATE zakaz_nodes
SET presence_type = CASE
  WHEN node_type = 'ao' THEN 'has_ao'::presence_type
  WHEN node_type IN ('pp', 'do_ls', 'other') THEN 'has_node'::presence_type
  ELSE 'has_node'::presence_type
END;

-- Пытаемся извлечь street и house из поля address для существующих узлов
-- (это необязательно, можно оставить NULL и заполнить вручную позже)
-- Формат адреса может быть "ул. Ленина, 5" или "Ленина 5" и т.д.

-- =====================================================
-- ЭТАП 4: Перенос данных из zakaz_addresses в zakaz_nodes
-- =====================================================

-- Создаем временную таблицу для маппинга старых ID на новые
CREATE TEMP TABLE address_id_mapping (
  old_address_id UUID,
  new_node_id BIGINT
);

-- Переносим все адреса из zakaz_addresses в zakaz_nodes
-- Для адресов без узла устанавливаем presence_type = 'not_present'
INSERT INTO zakaz_nodes (
  code,
  street,
  house,
  comment,
  address,
  presence_type,
  status,
  created_at,
  updated_at
)
SELECT
  -- Генерируем уникальный код для адреса (ADDR-<id>)
  'ADDR-' || SUBSTRING(id::text, 1, 8) as code,
  street,
  house,
  comment,
  CONCAT(street, ', ', house) as address,
  'not_present'::presence_type,
  'existing'::node_status,
  created_at,
  updated_at
FROM zakaz_addresses
-- Переносим только те адреса, которые еще не существуют в zakaz_nodes
WHERE NOT EXISTS (
  SELECT 1 FROM zakaz_nodes n
  WHERE n.street = zakaz_addresses.street
  AND n.house = zakaz_addresses.house
)
RETURNING id, SUBSTRING(code, 6, 8)::text
-- Сохраняем маппинг старых ID на новые
-- (Примечание: это не сработает напрямую, нужно использовать DO блок)
;

-- Используем DO блок для создания маппинга
DO $$
DECLARE
  addr_record RECORD;
  new_node_id BIGINT;
BEGIN
  -- Для каждого адреса из zakaz_addresses находим соответствующий node
  FOR addr_record IN SELECT * FROM zakaz_addresses LOOP
    -- Ищем node с такими же street и house
    SELECT id INTO new_node_id
    FROM zakaz_nodes
    WHERE street = addr_record.street
    AND house = addr_record.house
    LIMIT 1;

    -- Если нашли, сохраняем маппинг
    IF new_node_id IS NOT NULL THEN
      INSERT INTO address_id_mapping (old_address_id, new_node_id)
      VALUES (addr_record.id, new_node_id);
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- ЭТАП 5: Обновление ссылок в zakaz_applications
-- =====================================================

-- Добавляем временную колонку для нового ID
ALTER TABLE zakaz_applications ADD COLUMN node_id BIGINT;

-- Обновляем ссылки используя маппинг
UPDATE zakaz_applications app
SET node_id = mapping.new_node_id
FROM address_id_mapping mapping
WHERE app.address_id = mapping.old_address_id;

-- Добавляем внешний ключ на zakaz_nodes
ALTER TABLE zakaz_applications
  ADD CONSTRAINT fk_applications_node
  FOREIGN KEY (node_id) REFERENCES zakaz_nodes(id)
  ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_applications_node_id ON zakaz_applications(node_id);

-- =====================================================
-- ЭТАП 6: Очистка старых данных
-- =====================================================

-- Удаляем старую колонку address_id (после переноса данных)
-- ВНИМАНИЕ: Это необратимая операция!
ALTER TABLE zakaz_applications DROP COLUMN address_id;

-- Удаляем таблицу zakaz_addresses
-- ВНИМАНИЕ: Это необратимая операция!
DROP TABLE IF EXISTS zakaz_addresses CASCADE;

-- Удаляем временную таблицу маппинга
DROP TABLE IF EXISTS address_id_mapping;

-- =====================================================
-- ЭТАП 7: Создание индексов и ограничений
-- =====================================================

-- Создаем уникальный индекс для street + house
-- (один адрес может иметь несколько типов присутствия)
CREATE INDEX idx_nodes_street_house ON zakaz_nodes(street, house);

-- Создаем индекс для поиска по типу присутствия
CREATE INDEX idx_nodes_presence_type ON zakaz_nodes(presence_type);

-- Обновляем полнотекстовый индекс для поиска по адресу
-- (теперь включаем street и house)
DROP INDEX IF EXISTS idx_nodes_address;
CREATE INDEX idx_nodes_street_trgm ON zakaz_nodes USING gin(street gin_trgm_ops);
CREATE INDEX idx_nodes_house_trgm ON zakaz_nodes USING gin(house gin_trgm_ops);

-- Создаем комбинированный индекс для быстрого поиска
CREATE INDEX idx_nodes_street_house_presence ON zakaz_nodes(street, house, presence_type);

-- =====================================================
-- ЭТАП 8: Обновление прав доступа
-- =====================================================

-- Гарантируем, что все права сохранены
GRANT ALL ON zakaz_nodes TO authenticator;
GRANT ALL ON zakaz_nodes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE zakaz_nodes_id_seq TO authenticator;
GRANT USAGE, SELECT ON SEQUENCE zakaz_nodes_id_seq TO service_role;

-- =====================================================
-- РЕЗЮМЕ ИЗМЕНЕНИЙ
-- =====================================================

-- После выполнения миграции:
-- 1. ✅ Таблица zakaz_nodes содержит все адреса (с узлами и без)
-- 2. ✅ Добавлено поле presence_type для классификации присутствия
-- 3. ✅ Добавлены структурированные поля street, house, comment
-- 4. ✅ Все заявки теперь ссылаются на zakaz_nodes через node_id
-- 5. ✅ Таблица zakaz_addresses удалена
-- 6. ✅ Созданы необходимые индексы для быстрого поиска
