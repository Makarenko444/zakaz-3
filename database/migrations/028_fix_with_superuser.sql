-- Миграция 028: Исправление с правами суперпользователя
-- Дата: 2025-11-27
-- Выполнить от: supabase_admin или другого суперпользователя
--
-- Этот скрипт исправляет проблемы с правами доступа

-- =====================================================
-- ПОДГОТОВКА: Временно становимся владельцами таблиц
-- =====================================================

-- Сохраняем текущих владельцев
DO $$
DECLARE
  nodes_owner TEXT;
  apps_owner TEXT;
BEGIN
  -- Получаем текущих владельцев
  SELECT tableowner INTO nodes_owner FROM pg_tables WHERE tablename = 'zakaz_nodes';
  SELECT tableowner INTO apps_owner FROM pg_tables WHERE tablename = 'zakaz_applications';

  RAISE NOTICE 'Текущий владелец zakaz_nodes: %', nodes_owner;
  RAISE NOTICE 'Текущий владелец zakaz_applications: %', apps_owner;

  -- Временно меняем владельца на текущего пользователя
  EXECUTE format('ALTER TABLE zakaz_nodes OWNER TO %I', current_user);
  EXECUTE format('ALTER TABLE zakaz_applications OWNER TO %I', current_user);

  RAISE NOTICE 'Владелец временно изменен на: %', current_user;
END $$;

-- =====================================================
-- ЭТАП 1: Удаление старого триггера
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_node_address ON zakaz_nodes CASCADE;
DROP FUNCTION IF EXISTS update_node_address() CASCADE;

-- =====================================================
-- ЭТАП 2: Обработка zakaz_nodes
-- =====================================================

-- Добавляем колонку address_id (если еще нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zakaz_nodes' AND column_name = 'address_id'
  ) THEN
    ALTER TABLE zakaz_nodes ADD COLUMN address_id UUID;
    RAISE NOTICE 'Колонка address_id добавлена в zakaz_nodes';
  ELSE
    RAISE NOTICE 'Колонка address_id уже существует в zakaz_nodes';
  END IF;
END $$;

-- Заполняем address_id для всех узлов
UPDATE zakaz_nodes n
SET address_id = a.id
FROM zakaz_addresses a
WHERE n.city = a.city
  AND COALESCE(n.street, '') = COALESCE(a.street, '')
  AND COALESCE(n.house, '') = COALESCE(a.house, '')
  AND COALESCE(n.building, '') = COALESCE(a.building, '')
  AND n.address_id IS NULL;

-- Проверяем результат
DO $$
DECLARE
  total_nodes INTEGER;
  nodes_with_addr INTEGER;
  nodes_without_addr INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_nodes FROM zakaz_nodes;
  SELECT COUNT(*) INTO nodes_with_addr FROM zakaz_nodes WHERE address_id IS NOT NULL;
  SELECT COUNT(*) INTO nodes_without_addr FROM zakaz_nodes WHERE address_id IS NULL;

  RAISE NOTICE '=== УЗЛЫ (zakaz_nodes) ===';
  RAISE NOTICE 'Всего узлов: %', total_nodes;
  RAISE NOTICE 'С адресом: %', nodes_with_addr;
  RAISE NOTICE 'Без адреса: %', nodes_without_addr;

  IF nodes_without_addr > 0 THEN
    RAISE WARNING 'Некоторые узлы не получили address_id! Проверьте данные.';
  END IF;
END $$;

-- Делаем address_id обязательным (только если все узлы получили адрес)
DO $$
DECLARE
  nodes_without_addr INTEGER;
BEGIN
  SELECT COUNT(*) INTO nodes_without_addr FROM zakaz_nodes WHERE address_id IS NULL;

  IF nodes_without_addr = 0 THEN
    ALTER TABLE zakaz_nodes ALTER COLUMN address_id SET NOT NULL;
    RAISE NOTICE 'Колонка address_id установлена как NOT NULL';
  ELSE
    RAISE WARNING 'НЕ устанавливаем NOT NULL, т.к. есть узлы без адреса: %', nodes_without_addr;
  END IF;
END $$;

-- Добавляем внешний ключ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_nodes_address'
  ) THEN
    ALTER TABLE zakaz_nodes
      ADD CONSTRAINT fk_nodes_address
      FOREIGN KEY (address_id) REFERENCES zakaz_addresses(id)
      ON DELETE RESTRICT;
    RAISE NOTICE 'Создан FK fk_nodes_address';
  ELSE
    RAISE NOTICE 'FK fk_nodes_address уже существует';
  END IF;
END $$;

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_nodes_address_id ON zakaz_nodes(address_id);

-- =====================================================
-- ЭТАП 3: Обработка zakaz_applications
-- =====================================================

-- Проверяем наличие колонки address_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zakaz_applications' AND column_name = 'address_id'
  ) THEN
    ALTER TABLE zakaz_applications ADD COLUMN address_id UUID;
    RAISE NOTICE 'Колонка address_id добавлена в zakaz_applications';
  ELSE
    RAISE NOTICE 'Колонка address_id уже существует в zakaz_applications';
  END IF;
END $$;

-- Заполняем address_id через node_id
UPDATE zakaz_applications app
SET address_id = n.address_id
FROM zakaz_nodes n
WHERE app.node_id IS NOT NULL
  AND app.node_id::text = n.id::text
  AND app.address_id IS NULL
  AND n.address_id IS NOT NULL;

-- Проверяем результат
DO $$
DECLARE
  total_apps INTEGER;
  apps_with_addr INTEGER;
  apps_without_addr INTEGER;
  apps_with_node INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_apps FROM zakaz_applications;
  SELECT COUNT(*) INTO apps_with_addr FROM zakaz_applications WHERE address_id IS NOT NULL;
  SELECT COUNT(*) INTO apps_without_addr FROM zakaz_applications WHERE address_id IS NULL;
  SELECT COUNT(*) INTO apps_with_node FROM zakaz_applications WHERE node_id IS NOT NULL;

  RAISE NOTICE '=== ЗАЯВКИ (zakaz_applications) ===';
  RAISE NOTICE 'Всего заявок: %', total_apps;
  RAISE NOTICE 'С адресом: %', apps_with_addr;
  RAISE NOTICE 'Без адреса: %', apps_without_addr;
  RAISE NOTICE 'С узлом (node_id): %', apps_with_node;

  IF apps_with_node > apps_with_addr THEN
    RAISE WARNING 'Некоторые заявки с node_id не получили address_id!';
  END IF;
END $$;

-- Добавляем внешний ключ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_applications_address'
  ) THEN
    ALTER TABLE zakaz_applications
      ADD CONSTRAINT fk_applications_address
      FOREIGN KEY (address_id) REFERENCES zakaz_addresses(id)
      ON DELETE SET NULL;
    RAISE NOTICE 'Создан FK fk_applications_address';
  ELSE
    RAISE NOTICE 'FK fk_applications_address уже существует';
  END IF;
END $$;

-- Создаем индекс
CREATE INDEX IF NOT EXISTS idx_applications_address_id ON zakaz_applications(address_id);

-- =====================================================
-- ЭТАП 4: Удаление дублирующихся полей из zakaz_nodes
-- =====================================================

-- Удаляем индексы
DROP INDEX IF EXISTS idx_zakaz_nodes_city;
DROP INDEX IF EXISTS idx_zakaz_nodes_city_street;
DROP INDEX IF EXISTS idx_nodes_street_house;
DROP INDEX IF EXISTS idx_nodes_street_trgm;
DROP INDEX IF EXISTS idx_nodes_house_trgm;
DROP INDEX IF EXISTS idx_nodes_street_house_presence;

-- Удаляем колонки (если они еще есть)
DO $$
BEGIN
  -- Проверяем наличие каждой колонки и удаляем
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'city') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN city CASCADE;
    RAISE NOTICE 'Удалена колонка city';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'street') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN street CASCADE;
    RAISE NOTICE 'Удалена колонка street';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'house') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN house CASCADE;
    RAISE NOTICE 'Удалена колонка house';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'building') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN building CASCADE;
    RAISE NOTICE 'Удалена колонка building';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'address') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN address CASCADE;
    RAISE NOTICE 'Удалена колонка address';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'zakaz_nodes' AND column_name = 'comment') THEN
    ALTER TABLE zakaz_nodes DROP COLUMN comment CASCADE;
    RAISE NOTICE 'Удалена колонка comment';
  END IF;
END $$;

-- =====================================================
-- ЭТАП 5: Обновление комментариев
-- =====================================================

COMMENT ON TABLE zakaz_nodes IS
  'Узлы связи (оборудование на адресах). Адрес хранится в zakaz_addresses, ссылка через address_id';

COMMENT ON COLUMN zakaz_nodes.address_id IS
  'Ссылка на адрес из справочника zakaz_addresses';

COMMENT ON COLUMN zakaz_nodes.location_details IS
  'Подробное описание местоположения узла НА АДРЕСЕ (подъезд, этаж, организация)';

COMMENT ON COLUMN zakaz_applications.address_id IS
  'Ссылка на адрес из справочника zakaz_addresses (привязывается после создания заявки)';

-- =====================================================
-- ЭТАП 6: Восстановление владельцев таблиц
-- =====================================================

-- Возвращаем владельцев (если нужно)
-- Обычно оставляем как есть, т.к. суперпользователь имеет все права

-- =====================================================
-- ФИНАЛЬНАЯ ПРОВЕРКА
-- =====================================================

DO $$
DECLARE
  addr_count INTEGER;
  node_count INTEGER;
  node_with_addr INTEGER;
  app_count INTEGER;
  app_with_addr INTEGER;
BEGIN
  SELECT COUNT(*) INTO addr_count FROM zakaz_addresses;
  SELECT COUNT(*) INTO node_count FROM zakaz_nodes;
  SELECT COUNT(*) INTO node_with_addr FROM zakaz_nodes WHERE address_id IS NOT NULL;
  SELECT COUNT(*) INTO app_count FROM zakaz_applications;
  SELECT COUNT(*) INTO app_with_addr FROM zakaz_applications WHERE address_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '           РЕЗУЛЬТАТЫ МИГРАЦИИ 028';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Адресов (zakaz_addresses): %', addr_count;
  RAISE NOTICE 'Узлов всего: %', node_count;
  RAISE NOTICE 'Узлов с адресом: % (%.1f%%)', node_with_addr, (node_with_addr::float / NULLIF(node_count, 0) * 100);
  RAISE NOTICE 'Заявок всего: %', app_count;
  RAISE NOTICE 'Заявок с адресом: % (%.1f%%)', app_with_addr, (app_with_addr::float / NULLIF(app_count, 0) * 100);
  RAISE NOTICE '';

  IF node_with_addr = node_count AND app_with_addr > 0 THEN
    RAISE NOTICE '✅ Миграция 028 выполнена УСПЕШНО!';
  ELSE
    RAISE WARNING '⚠️  Миграция завершена с предупреждениями. Проверьте данные.';
  END IF;

  RAISE NOTICE '==================================================';
END $$;
