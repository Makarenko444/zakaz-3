-- Исправление связи zakaz_applications с zakaz_addresses
-- Дата: 2025-11-27

-- =====================================================
-- ДИАГНОСТИКА
-- =====================================================

DO $$
DECLARE
  total_apps INTEGER;
  apps_with_node_id INTEGER;
  apps_with_address_id INTEGER;
  apps_with_street TEXT;
BEGIN
  SELECT COUNT(*) INTO total_apps FROM zakaz_applications;
  SELECT COUNT(*) INTO apps_with_node_id FROM zakaz_applications WHERE node_id IS NOT NULL;
  SELECT COUNT(*) INTO apps_with_address_id FROM zakaz_applications WHERE address_id IS NOT NULL;
  SELECT street_and_house INTO apps_with_street FROM zakaz_applications LIMIT 1;

  RAISE NOTICE '=== ДИАГНОСТИКА zakaz_applications ===';
  RAISE NOTICE 'Всего заявок: %', total_apps;
  RAISE NOTICE 'С node_id: %', apps_with_node_id;
  RAISE NOTICE 'С address_id: %', apps_with_address_id;
  RAISE NOTICE 'Пример street_and_house: %', apps_with_street;
  RAISE NOTICE '';
END $$;

-- =====================================================
-- ВАРИАНТ 1: Заполнение через node_id (если есть)
-- =====================================================

-- Попробуем разные варианты JOIN
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Вариант A: Прямое сравнение (если оба BIGINT)
  WITH updated AS (
    UPDATE zakaz_applications app
    SET address_id = n.address_id
    FROM zakaz_nodes n
    WHERE app.node_id = n.id
      AND app.address_id IS NULL
      AND n.address_id IS NOT NULL
    RETURNING app.id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Обновлено через node_id (прямое сравнение): %', updated_count;
  END IF;
END $$;

-- =====================================================
-- ВАРИАНТ 2: Заполнение через поиск по адресу
-- =====================================================

-- Если node_id не заполнен, пытаемся найти адрес по street_and_house
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE zakaz_applications app
    SET address_id = addr.id
    FROM zakaz_addresses addr
    WHERE app.address_id IS NULL
      AND app.street_and_house IS NOT NULL
      AND app.street_and_house != ''
      -- Ищем совпадение в адресе
      AND (
        addr.address ILIKE '%' || app.street_and_house || '%'
        OR app.street_and_house ILIKE '%' || addr.street || '%'
      )
    RETURNING app.id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Обновлено через поиск по адресу: %', updated_count;
  END IF;
END $$;

-- =====================================================
-- ПРОВЕРКА РЕЗУЛЬТАТА
-- =====================================================

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

  RAISE NOTICE '';
  RAISE NOTICE '=== РЕЗУЛЬТАТ ОБНОВЛЕНИЯ ===';
  RAISE NOTICE 'Всего заявок: %', total_apps;
  RAISE NOTICE 'С адресом: % (%.1f%%)', apps_with_addr, (apps_with_addr::float / NULLIF(total_apps, 0) * 100);
  RAISE NOTICE 'Без адреса: %', apps_without_addr;
  RAISE NOTICE 'С узлом (node_id): %', apps_with_node;
  RAISE NOTICE '';

  IF apps_with_addr = total_apps THEN
    RAISE NOTICE '✅ Все заявки получили address_id!';
  ELSIF apps_with_addr > 0 THEN
    RAISE NOTICE '⚠️  Часть заявок получила address_id';
    RAISE NOTICE 'Заявки без адреса нужно обработать вручную или через мастер привязки';
  ELSE
    RAISE WARNING '❌ Ни одна заявка не получила address_id';
    RAISE NOTICE 'Проверьте данные в zakaz_applications';
  END IF;
END $$;

-- Показываем несколько заявок для проверки
SELECT
  id,
  application_number,
  street_and_house,
  node_id,
  address_id,
  address_match_status
FROM zakaz_applications
ORDER BY created_at DESC
LIMIT 5;
