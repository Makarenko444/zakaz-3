-- Migration: Fill required fields from alternative sources
-- Description: Заполняет пустые обязательные поля из альтернативных источников
-- Обязательные поля: customer_phone, street_and_house

-- ============================================
-- 1. Заполнение customer_phone из contact_phone
-- ============================================

-- Сначала смотрим сколько записей можно заполнить (для логирования)
DO $$
DECLARE
  count_to_update INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_update
  FROM zakaz_applications
  WHERE (customer_phone IS NULL OR customer_phone = '')
    AND contact_phone IS NOT NULL
    AND contact_phone != '';

  RAISE NOTICE 'Записей с пустым customer_phone, но с contact_phone: %', count_to_update;
END $$;

-- Обновляем customer_phone из contact_phone
UPDATE zakaz_applications
SET
  customer_phone = contact_phone,
  updated_at = NOW()
WHERE (customer_phone IS NULL OR customer_phone = '')
  AND contact_phone IS NOT NULL
  AND contact_phone != '';

-- ============================================
-- 2. Заполнение street_and_house из street_and_house_original
-- ============================================

-- Сначала смотрим сколько записей можно заполнить
DO $$
DECLARE
  count_to_update INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_update
  FROM zakaz_applications
  WHERE (street_and_house IS NULL OR street_and_house = '')
    AND street_and_house_original IS NOT NULL
    AND street_and_house_original != '';

  RAISE NOTICE 'Записей с пустым street_and_house, но с street_and_house_original: %', count_to_update;
END $$;

-- Обновляем street_and_house из street_and_house_original
UPDATE zakaz_applications
SET
  street_and_house = street_and_house_original,
  updated_at = NOW()
WHERE (street_and_house IS NULL OR street_and_house = '')
  AND street_and_house_original IS NOT NULL
  AND street_and_house_original != '';

-- ============================================
-- 3. Итоговая статистика
-- ============================================

DO $$
DECLARE
  remaining_empty_phones INTEGER;
  remaining_empty_streets INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_empty_phones
  FROM zakaz_applications
  WHERE customer_phone IS NULL OR customer_phone = '';

  SELECT COUNT(*) INTO remaining_empty_streets
  FROM zakaz_applications
  WHERE street_and_house IS NULL OR street_and_house = '';

  RAISE NOTICE '--- Итоговая статистика ---';
  RAISE NOTICE 'Осталось записей с пустым customer_phone: %', remaining_empty_phones;
  RAISE NOTICE 'Осталось записей с пустым street_and_house: %', remaining_empty_streets;
END $$;
