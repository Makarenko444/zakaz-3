-- Миграция 034: Извлечение города из поля street_and_house
-- Дата: 2025-12-09
-- Описание: Парсит адреса и извлекает город в отдельное поле

-- ============================================================
-- ЧАСТЬ 1: Предварительный просмотр (DRY RUN)
-- ============================================================

-- Посмотрим, что будет изменено (без реальных изменений)
SELECT
  'PREVIEW' as mode,
  city_extracted,
  new_street_and_house,
  COUNT(*) as cnt
FROM (
  SELECT
    CASE
      -- "Томск, ..." или "томск, ..."
      WHEN street_and_house ~* '^томск\s*,' THEN 'Томск'
      -- "г Томск, ..." или "г.Томск, ..." или "г. Томск, ..."
      WHEN street_and_house ~* '^г\.?\s*томск\s*,' THEN 'Томск'
      -- "Северск, ..."
      WHEN street_and_house ~* '^северск\s*,' THEN 'Северск'
      -- "г Северск, ..." или "г.Северск, ..."
      WHEN street_and_house ~* '^г\.?\s*северск\s*,' THEN 'Северск'
      -- "ЗАТО Северск, ..."
      WHEN street_and_house ~* '^зато\s+северск\s*,' THEN 'Северск'
      -- "Томская обл, г Томск, ..."
      WHEN street_and_house ~* '^томская\s+обл' THEN 'Томск'
      -- По умолчанию оставляем текущее значение (Томск)
      ELSE NULL
    END as city_extracted,
    CASE
      -- Убираем "Томск, " из начала
      WHEN street_and_house ~* '^томск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^[Тт]омск\s*,\s*', ''))
      -- Убираем "г Томск, " или "г.Томск, " из начала
      WHEN street_and_house ~* '^г\.?\s*томск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^г\.?\s*[Тт]омск\s*,\s*', ''))
      -- Убираем "Северск, " из начала
      WHEN street_and_house ~* '^северск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^[Сс]еверск\s*,\s*', ''))
      -- Убираем "г Северск, " из начала
      WHEN street_and_house ~* '^г\.?\s*северск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^г\.?\s*[Сс]еверск\s*,\s*', ''))
      -- Убираем "ЗАТО Северск, " из начала
      WHEN street_and_house ~* '^зато\s+северск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^[Зз][Аа][Тт][Оо]\s+[Сс]еверск\s*,\s*', ''))
      -- Убираем "Томская обл, г Томск, " из начала
      WHEN street_and_house ~* '^томская\s+обл[^\,]*,\s*г\.?\s*томск\s*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^[Тт]омская\s+обл[^\,]*,\s*г\.?\s*[Тт]омск\s*,\s*', ''))
      WHEN street_and_house ~* '^томская\s+обл[^\,]*,\s*'
        THEN TRIM(REGEXP_REPLACE(street_and_house, '^[Тт]омская\s+обл[^\,]*,\s*', ''))
      ELSE NULL
    END as new_street_and_house
  FROM zakaz_applications
  WHERE street_and_house IS NOT NULL
) sub
WHERE city_extracted IS NOT NULL
GROUP BY city_extracted, new_street_and_house
ORDER BY cnt DESC
LIMIT 50;

-- ============================================================
-- ЧАСТЬ 2: Подсчёт затрагиваемых записей
-- ============================================================

SELECT
  'STATISTICS' as info,
  SUM(CASE WHEN street_and_house ~* '^(томск|г\.?\s*томск)\s*,' THEN 1 ELSE 0 END) as tomsk_count,
  SUM(CASE WHEN street_and_house ~* '^(северск|г\.?\s*северск|зато\s+северск)\s*,' THEN 1 ELSE 0 END) as seversk_count,
  SUM(CASE WHEN street_and_house ~* '^томская\s+обл' THEN 1 ELSE 0 END) as tomsk_obl_count,
  COUNT(*) as total
FROM zakaz_applications
WHERE street_and_house IS NOT NULL;

-- ============================================================
-- ЧАСТЬ 3: ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ
-- Раскомментируйте этот блок после проверки preview
-- ============================================================

/*
-- 3.1. Обновляем Томск
UPDATE zakaz_applications
SET
  city = 'Томск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^[Тт]омск\s*,\s*', ''))
WHERE street_and_house ~* '^томск\s*,';

-- 3.2. Обновляем "г Томск" / "г.Томск"
UPDATE zakaz_applications
SET
  city = 'Томск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^г\.?\s*[Тт]омск\s*,\s*', ''))
WHERE street_and_house ~* '^г\.?\s*томск\s*,';

-- 3.3. Обновляем Северск
UPDATE zakaz_applications
SET
  city = 'Северск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^[Сс]еверск\s*,\s*', ''))
WHERE street_and_house ~* '^северск\s*,';

-- 3.4. Обновляем "г Северск"
UPDATE zakaz_applications
SET
  city = 'Северск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^г\.?\s*[Сс]еверск\s*,\s*', ''))
WHERE street_and_house ~* '^г\.?\s*северск\s*,';

-- 3.5. Обновляем "ЗАТО Северск"
UPDATE zakaz_applications
SET
  city = 'Северск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^[Зз][Аа][Тт][Оо]\s+[Сс]еверск\s*,\s*', ''))
WHERE street_and_house ~* '^зато\s+северск\s*,';

-- 3.6. Обновляем "Томская обл, г Томск, ..."
UPDATE zakaz_applications
SET
  city = 'Томск',
  street_and_house = TRIM(REGEXP_REPLACE(street_and_house, '^[Тт]омская\s+обл[^\,]*,\s*(г\.?\s*[Тт]омск\s*,\s*)?', ''))
WHERE street_and_house ~* '^томская\s+обл';
*/

-- ============================================================
-- ЧАСТЬ 4: Проверка результатов (после применения)
-- ============================================================

SELECT
  city,
  COUNT(*) as cnt
FROM zakaz_applications
GROUP BY city
ORDER BY cnt DESC;
