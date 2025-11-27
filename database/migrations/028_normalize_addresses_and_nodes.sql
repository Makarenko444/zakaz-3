-- Миграция 028: Нормализация адресов и узлов
-- Дата: 2025-11-27
-- Описание:
--   Решение проблемы дублирования адресов при импорте узлов
--   1. Создаем отдельную таблицу zakaz_addresses для хранения уникальных адресов
--   2. Извлекаем уникальные адреса из zakaz_nodes
--   3. Связываем zakaz_nodes с zakaz_addresses через address_id
--   4. Связываем zakaz_applications с zakaz_addresses через address_id
--   5. Удаляем дублирующиеся поля адреса из zakaz_nodes

-- =====================================================
-- ЭТАП 1: Создание таблицы zakaz_addresses
-- =====================================================

CREATE TABLE zakaz_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Структурированные поля адреса
  city VARCHAR(200) NOT NULL,
  street VARCHAR(500),
  house VARCHAR(50),
  building VARCHAR(50),

  -- Полный адрес (автоматически формируется триггером)
  address TEXT NOT NULL,

  -- Комментарий к адресу
  comment TEXT,

  -- Служебные поля
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Создаем уникальный индекс для комбинации city + street + house + building
-- Это гарантирует, что один адрес не будет добавлен дважды
CREATE UNIQUE INDEX idx_addresses_unique ON zakaz_addresses(
  city,
  COALESCE(street, ''),
  COALESCE(house, ''),
  COALESCE(building, '')
);

-- Индексы для быстрого поиска
CREATE INDEX idx_addresses_city ON zakaz_addresses(city);
CREATE INDEX idx_addresses_city_street ON zakaz_addresses(city, street);
CREATE INDEX idx_addresses_street_house ON zakaz_addresses(street, house);

-- Полнотекстовые индексы для поиска
CREATE INDEX idx_addresses_street_trgm ON zakaz_addresses USING gin(street gin_trgm_ops);
CREATE INDEX idx_addresses_house_trgm ON zakaz_addresses USING gin(house gin_trgm_ops);
CREATE INDEX idx_addresses_address_trgm ON zakaz_addresses USING gin(address gin_trgm_ops);

-- Комментарии
COMMENT ON TABLE zakaz_addresses IS 'Справочник уникальных адресов';
COMMENT ON COLUMN zakaz_addresses.city IS 'Город';
COMMENT ON COLUMN zakaz_addresses.street IS 'Улица';
COMMENT ON COLUMN zakaz_addresses.house IS 'Номер дома';
COMMENT ON COLUMN zakaz_addresses.building IS 'Строение/корпус';
COMMENT ON COLUMN zakaz_addresses.address IS 'Полный адрес (автоматически формируется)';
COMMENT ON COLUMN zakaz_addresses.comment IS 'Комментарий к адресу';

-- =====================================================
-- ЭТАП 2: Создание функции форматирования адреса
-- =====================================================

-- Переименовываем старую функцию
DROP FUNCTION IF EXISTS format_node_address(VARCHAR, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION format_address(
  p_city VARCHAR,
  p_street VARCHAR,
  p_house VARCHAR,
  p_building VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN TRIM(
    CONCAT_WS(', ',
      NULLIF(p_city, ''),
      NULLIF(p_street, ''),
      CASE
        WHEN p_house IS NOT NULL THEN CONCAT('д. ', p_house)
        ELSE NULL
      END,
      NULLIF(p_building, '')
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION format_address IS 'Формирует полный адрес из компонентов';

-- =====================================================
-- ЭТАП 3: Триггер для автоматического обновления address
-- =====================================================

CREATE OR REPLACE FUNCTION update_address_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.address := format_address(NEW.city, NEW.street, NEW.house, NEW.building);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_address
  BEFORE INSERT OR UPDATE OF city, street, house, building ON zakaz_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_address_trigger();

COMMENT ON TRIGGER trigger_update_address ON zakaz_addresses IS
  'Автоматически обновляет поле address при изменении компонентов адреса';

-- =====================================================
-- ЭТАП 4: Извлечение уникальных адресов из zakaz_nodes
-- =====================================================

-- Вставляем уникальные адреса из zakaz_nodes в zakaz_addresses
INSERT INTO zakaz_addresses (city, street, house, building, comment, created_at, updated_at)
SELECT DISTINCT ON (city, COALESCE(street, ''), COALESCE(house, ''), COALESCE(building, ''))
  city,
  street,
  house,
  building,
  comment,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM zakaz_nodes
WHERE city IS NOT NULL  -- Город обязателен для адреса
GROUP BY city, street, house, building, comment
ON CONFLICT (city, COALESCE(street, ''), COALESCE(house, ''), COALESCE(building, ''))
DO NOTHING;

-- =====================================================
-- ЭТАП 5: Добавление address_id в zakaz_nodes
-- =====================================================

-- Добавляем колонку address_id в zakaz_nodes
ALTER TABLE zakaz_nodes
  ADD COLUMN address_id UUID;

-- Заполняем address_id для существующих узлов
UPDATE zakaz_nodes n
SET address_id = a.id
FROM zakaz_addresses a
WHERE n.city = a.city
  AND COALESCE(n.street, '') = COALESCE(a.street, '')
  AND COALESCE(n.house, '') = COALESCE(a.house, '')
  AND COALESCE(n.building, '') = COALESCE(a.building, '');

-- Делаем address_id обязательным (NOT NULL)
ALTER TABLE zakaz_nodes
  ALTER COLUMN address_id SET NOT NULL;

-- Добавляем внешний ключ
ALTER TABLE zakaz_nodes
  ADD CONSTRAINT fk_nodes_address
  FOREIGN KEY (address_id) REFERENCES zakaz_addresses(id)
  ON DELETE RESTRICT;  -- Нельзя удалить адрес, если на него ссылаются узлы

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_nodes_address_id ON zakaz_nodes(address_id);

COMMENT ON COLUMN zakaz_nodes.address_id IS 'Ссылка на адрес из справочника zakaz_addresses';

-- =====================================================
-- ЭТАП 6: Обновление zakaz_applications
-- =====================================================

-- Добавляем колонку address_id в zakaz_applications
ALTER TABLE zakaz_applications
  ADD COLUMN address_id UUID;

-- Заполняем address_id через связь с zakaz_nodes
UPDATE zakaz_applications app
SET address_id = n.address_id
FROM zakaz_nodes n
WHERE app.node_id::text = n.id::text;

-- НЕ делаем address_id обязательным, так как он может быть NULL для новых заявок
-- (пользователь вводит адрес вручную, а потом его привязывают)

-- Добавляем внешний ключ
ALTER TABLE zakaz_applications
  ADD CONSTRAINT fk_applications_address
  FOREIGN KEY (address_id) REFERENCES zakaz_addresses(id)
  ON DELETE SET NULL;  -- При удалении адреса устанавливаем NULL

-- Создаем индекс для быстрого поиска
CREATE INDEX idx_applications_address_id ON zakaz_applications(address_id);

COMMENT ON COLUMN zakaz_applications.address_id IS 'Ссылка на адрес из справочника zakaz_addresses (привязывается после создания заявки)';

-- =====================================================
-- ЭТАП 7: Удаление дублирующихся полей из zakaz_nodes
-- =====================================================

-- Удаляем триггер, который обновлял address в zakaz_nodes
DROP TRIGGER IF EXISTS trigger_update_node_address ON zakaz_nodes;
DROP FUNCTION IF EXISTS update_node_address();

-- Удаляем ненужные индексы
DROP INDEX IF EXISTS idx_zakaz_nodes_city;
DROP INDEX IF EXISTS idx_zakaz_nodes_city_street;
DROP INDEX IF EXISTS idx_nodes_street_house;
DROP INDEX IF EXISTS idx_nodes_street_trgm;
DROP INDEX IF EXISTS idx_nodes_house_trgm;
DROP INDEX IF EXISTS idx_nodes_street_house_presence;

-- Удаляем дублирующиеся колонки из zakaz_nodes
ALTER TABLE zakaz_nodes
  DROP COLUMN city,
  DROP COLUMN street,
  DROP COLUMN house,
  DROP COLUMN building,
  DROP COLUMN address,
  DROP COLUMN comment;

-- Обновляем комментарий к таблице
COMMENT ON TABLE zakaz_nodes IS
  'Узлы связи (оборудование на адресах). Адрес хранится в zakaz_addresses, ссылка через address_id';

COMMENT ON COLUMN zakaz_nodes.location_details IS
  'Подробное описание местоположения узла НА АДРЕСЕ (подъезд, этаж, организация)';

-- =====================================================
-- ЭТАП 8: Обновление прав доступа
-- =====================================================

-- Предоставляем права на новую таблицу
GRANT ALL ON zakaz_addresses TO authenticator;
GRANT ALL ON zakaz_addresses TO service_role;

-- =====================================================
-- ЭТАП 9: Обновление функции статистики
-- =====================================================

-- Обновляем функцию get_applications_by_address_stats для работы с новой структурой
DROP FUNCTION IF EXISTS get_applications_by_address_stats();

CREATE OR REPLACE FUNCTION get_applications_by_address_stats()
RETURNS TABLE (
  address_id UUID,
  address TEXT,
  city TEXT,
  street TEXT,
  house TEXT,
  building TEXT,
  status TEXT,
  status_name TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    addr.id AS address_id,
    addr.address,
    addr.city,
    addr.street,
    addr.house,
    addr.building,
    a.status::TEXT AS status,
    s.name_ru AS status_name,
    COUNT(a.id) AS count
  FROM zakaz_addresses addr
  INNER JOIN zakaz_applications a ON a.address_id = addr.id
  INNER JOIN zakaz_application_statuses s ON s.code = a.status::TEXT
  WHERE a.status IS NOT NULL
  GROUP BY addr.id, addr.address, addr.city, addr.street, addr.house, addr.building, a.status, s.name_ru
  ORDER BY addr.address, s.sort_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_applications_by_address_stats() IS
  'Возвращает статистику заявок по адресам с разбивкой по статусам';

-- =====================================================
-- РЕЗЮМЕ ИЗМЕНЕНИЙ
-- =====================================================

-- После выполнения миграции:
-- 1. ✅ Создана таблица zakaz_addresses с уникальными адресами
-- 2. ✅ Уникальные адреса извлечены из zakaz_nodes
-- 3. ✅ zakaz_nodes связана с zakaz_addresses через address_id
-- 4. ✅ zakaz_applications связана с zakaz_addresses через address_id
-- 5. ✅ Удалены дублирующиеся поля city, street, house, building, address, comment из zakaz_nodes
-- 6. ✅ Один адрес теперь может иметь несколько узлов (ПП1869-1, ПП1869-2, АО1372 на одном адресе)
-- 7. ✅ Заявки привязываются к адресам, а не к конкретным узлам
-- 8. ✅ Сохранена обратная совместимость: node_id в zakaz_applications не удалено

-- Структура теперь соответствует реальности:
-- - АДРЕС (zakaz_addresses): Томск, Сергея Лазо, д. 4/2
--   └─ УЗЕЛ 1 (zakaz_nodes): ПП1869-1 (присутствует на адресе)
--   └─ УЗЕЛ 2 (zakaz_nodes): ПП1869-2 (присутствует на адресе)
--   └─ УЗЕЛ 3 (zakaz_nodes): АО1372 (присутствует на адресе)
--   └─ ЗАЯВКА 1 (zakaz_applications): привязана к адресу
--   └─ ЗАЯВКА 2 (zakaz_applications): привязана к адресу
