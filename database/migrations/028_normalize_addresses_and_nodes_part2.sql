-- Миграция 028 (часть 2): Завершение нормализации zakaz_nodes
-- Дата: 2025-11-27
-- Описание: Выполнение команд, требующих прав владельца таблицы zakaz_nodes
--
-- ВНИМАНИЕ: Эти команды нужно выполнить от имени владельца таблицы zakaz_nodes
-- или от суперпользователя (supabase_admin)

-- =====================================================
-- ЭТАП 1: Удаление старого триггера (если существует)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_node_address ON zakaz_nodes CASCADE;
DROP FUNCTION IF EXISTS update_node_address() CASCADE;

-- =====================================================
-- ЭТАП 2: Добавление address_id в zakaz_nodes
-- =====================================================

-- Добавляем колонку address_id в zakaz_nodes (если еще не добавлена)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zakaz_nodes' AND column_name = 'address_id'
  ) THEN
    ALTER TABLE zakaz_nodes ADD COLUMN address_id UUID;
  END IF;
END $$;

-- Заполняем address_id для существующих узлов
UPDATE zakaz_nodes n
SET address_id = a.id
FROM zakaz_addresses a
WHERE n.city = a.city
  AND COALESCE(n.street, '') = COALESCE(a.street, '')
  AND COALESCE(n.house, '') = COALESCE(a.house, '')
  AND COALESCE(n.building, '') = COALESCE(a.building, '')
  AND n.address_id IS NULL;

-- Проверяем, что все узлы получили address_id
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM zakaz_nodes WHERE address_id IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE 'Внимание: % узлов не имеют address_id!', null_count;
    RAISE NOTICE 'Проверьте эти записи:';

    -- Показываем проблемные записи
    FOR rec IN
      SELECT id, code, city, street, house FROM zakaz_nodes WHERE address_id IS NULL LIMIT 10
    LOOP
      RAISE NOTICE 'ID: %, Code: %, City: %, Street: %, House: %',
        rec.id, rec.code, rec.city, rec.street, rec.house;
    END LOOP;

    RAISE EXCEPTION 'Миграция остановлена. Исправьте проблемные записи перед продолжением.';
  ELSE
    RAISE NOTICE 'Все узлы успешно получили address_id';
  END IF;
END $$;

-- Делаем address_id обязательным (NOT NULL)
ALTER TABLE zakaz_nodes
  ALTER COLUMN address_id SET NOT NULL;

-- Добавляем внешний ключ
ALTER TABLE zakaz_nodes
  ADD CONSTRAINT fk_nodes_address
  FOREIGN KEY (address_id) REFERENCES zakaz_addresses(id)
  ON DELETE RESTRICT;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_nodes_address_id ON zakaz_nodes(address_id);

COMMENT ON COLUMN zakaz_nodes.address_id IS 'Ссылка на адрес из справочника zakaz_addresses';

-- =====================================================
-- ЭТАП 3: Удаление дублирующихся полей из zakaz_nodes
-- =====================================================

-- Удаляем ненужные индексы
DROP INDEX IF EXISTS idx_zakaz_nodes_city;
DROP INDEX IF EXISTS idx_zakaz_nodes_city_street;
DROP INDEX IF EXISTS idx_nodes_street_house;
DROP INDEX IF EXISTS idx_nodes_street_trgm;
DROP INDEX IF EXISTS idx_nodes_house_trgm;
DROP INDEX IF EXISTS idx_nodes_street_house_presence;

-- Удаляем дублирующиеся колонки из zakaz_nodes
ALTER TABLE zakaz_nodes
  DROP COLUMN IF EXISTS city CASCADE,
  DROP COLUMN IF EXISTS street CASCADE,
  DROP COLUMN IF EXISTS house CASCADE,
  DROP COLUMN IF EXISTS building CASCADE,
  DROP COLUMN IF EXISTS address CASCADE,
  DROP COLUMN IF EXISTS comment CASCADE;

-- Обновляем комментарий к таблице
COMMENT ON TABLE zakaz_nodes IS
  'Узлы связи (оборудование на адресах). Адрес хранится в zakaz_addresses, ссылка через address_id';

COMMENT ON COLUMN zakaz_nodes.location_details IS
  'Подробное описание местоположения узла НА АДРЕСЕ (подъезд, этаж, организация)';

-- =====================================================
-- ЭТАП 4: Финальная проверка
-- =====================================================

DO $$
DECLARE
  addr_count INTEGER;
  node_count INTEGER;
  app_with_addr INTEGER;
BEGIN
  -- Считаем адреса
  SELECT COUNT(*) INTO addr_count FROM zakaz_addresses;
  RAISE NOTICE 'Всего уникальных адресов: %', addr_count;

  -- Считаем узлы
  SELECT COUNT(*) INTO node_count FROM zakaz_nodes;
  RAISE NOTICE 'Всего узлов: %', node_count;

  -- Считаем заявки с адресами
  SELECT COUNT(*) INTO app_with_addr FROM zakaz_applications WHERE address_id IS NOT NULL;
  RAISE NOTICE 'Заявок с привязкой к адресам: %', app_with_addr;

  RAISE NOTICE '✅ Миграция 028 завершена успешно!';
END $$;
