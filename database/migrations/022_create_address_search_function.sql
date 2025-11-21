-- Миграция 022: Создание функции для нечеткого поиска адресов
-- Дата: 2025-11-21
-- Описание:
--   Создание PostgreSQL функции для нечеткого (fuzzy) поиска адресов
--   с использованием расширения pg_trgm. Функция ищет по улице и дому,
--   возвращает результаты отсортированные по степени похожести.

-- Создаем функцию для нечеткого поиска адресов
CREATE OR REPLACE FUNCTION search_addresses_fuzzy(search_query TEXT)
RETURNS TABLE (
  id UUID,
  street TEXT,
  house TEXT,
  comment TEXT,
  similarity REAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.street,
    a.house,
    a.comment,
    -- Вычисляем максимальную схожесть между поиском и комбинацией полей
    GREATEST(
      similarity(a.street, search_query),
      similarity(a.house, search_query),
      similarity(a.street || ' ' || a.house, search_query)
    ) AS similarity,
    a.created_at,
    a.updated_at
  FROM zakaz_addresses a
  WHERE
    -- Используем GiST индекс для быстрого поиска
    a.street % search_query
    OR a.house % search_query
    OR (a.street || ' ' || a.house) % search_query
    -- Добавляем условие для минимальной схожести (порог 0.1)
    OR similarity(a.street, search_query) > 0.1
    OR similarity(a.house, search_query) > 0.1
    OR similarity(a.street || ' ' || a.house, search_query) > 0.1
  ORDER BY
    -- Сортируем по убыванию схожести
    GREATEST(
      similarity(a.street, search_query),
      similarity(a.house, search_query),
      similarity(a.street || ' ' || a.house, search_query)
    ) DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

-- Добавляем комментарий к функции
COMMENT ON FUNCTION search_addresses_fuzzy(TEXT) IS
  'Нечеткий поиск адресов с использованием триграмм. Возвращает до 20 наиболее похожих адресов отсортированных по степени схожести.';
