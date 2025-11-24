-- Миграция 025: Добавление полей city (город) и building (строение/корпус)
-- Дата: 2025-11-24
-- Описание: Разбиваем адрес на более детальные компоненты для лучшей структуризации

-- 1. Добавляем новые поля
ALTER TABLE zakaz_nodes
  ADD COLUMN IF NOT EXISTS city VARCHAR(200),
  ADD COLUMN IF NOT EXISTS building VARCHAR(50);

-- 2. Комментарии к полям
COMMENT ON COLUMN zakaz_nodes.city IS 'Город (например: Москва, Санкт-Петербург)';
COMMENT ON COLUMN zakaz_nodes.building IS 'Строение/корпус (например: корп. 2, стр. 1)';

-- 3. Устанавливаем значения по умолчанию для существующих записей
-- Все существующие адреса находятся в Томске
UPDATE zakaz_nodes
SET city = 'Томск'
WHERE city IS NULL;

-- 4. Обновляем функцию для формирования полного адреса
CREATE OR REPLACE FUNCTION format_node_address(
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

COMMENT ON FUNCTION format_node_address IS 'Формирует полный адрес из компонентов';

-- 5. Обновляем поле address для всех существующих записей
UPDATE zakaz_nodes
SET address = format_node_address(city, street, house, building);

-- 6. Создаем триггер для автоматического обновления поля address
CREATE OR REPLACE FUNCTION update_node_address()
RETURNS TRIGGER AS $$
BEGIN
  NEW.address := format_node_address(NEW.city, NEW.street, NEW.house, NEW.building);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_node_address ON zakaz_nodes;

CREATE TRIGGER trigger_update_node_address
  BEFORE INSERT OR UPDATE OF city, street, house, building ON zakaz_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_node_address();

COMMENT ON TRIGGER trigger_update_node_address ON zakaz_nodes IS
  'Автоматически обновляет поле address при изменении компонентов адреса';

-- 7. Обновляем индексы для оптимизации поиска
CREATE INDEX IF NOT EXISTS idx_zakaz_nodes_city ON zakaz_nodes(city);
CREATE INDEX IF NOT EXISTS idx_zakaz_nodes_city_street ON zakaz_nodes(city, street);

-- 8. Информация о миграции
COMMENT ON TABLE zakaz_nodes IS
  'Узлы связи и адреса. Структура адреса: city (город), street (улица), house (дом), building (строение/корпус)';
