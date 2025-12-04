-- Миграция 029: Удаление автоматических префиксов в адресах
-- Дата: 2025-12-04
-- Описание:
--   Убираем автоматическое добавление "д." перед номером дома.
--   Пользователь сам решает какие слова писать в полях адреса.

-- Обновляем функцию format_address
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
      NULLIF(p_house, ''),
      NULLIF(p_building, '')
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION format_address IS 'Формирует полный адрес из компонентов (без автоматических префиксов)';

-- Обновляем все существующие адреса с новым форматом
UPDATE zakaz_addresses
SET address = format_address(city, street, house, building);
