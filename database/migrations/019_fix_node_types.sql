-- Миграция 019: Исправление типов узлов
-- Дата: 2025-11-21
-- Описание:
--   Исправление типов узлов подключения на правильные:
--   - ПРП (узел связи)
--   - АО (абонентское окончание)
--   - СК (СКУД)
--   - РТК и другие (прочее)

-- Шаг 1: Добавляем новые значения в enum
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'prp';
ALTER TYPE node_type ADD VALUE IF NOT EXISTS 'sk';

-- Шаг 2: Обновляем существующие записи
-- Конвертируем 'pp' -> 'prp'
UPDATE zakaz_nodes SET node_type = 'prp' WHERE node_type = 'pp';

-- Шаг 3: Удаляем старые значения из enum (это невозможно сделать напрямую в PostgreSQL)
-- Вместо этого создаем новый enum и заменяем тип колонки

-- Создаем новый enum с правильными значениями
DROP TYPE IF EXISTS node_type_new CASCADE;
CREATE TYPE node_type_new AS ENUM ('prp', 'ao', 'sk', 'other');

-- Изменяем тип колонки используя USING для конвертации
ALTER TABLE zakaz_nodes
  ALTER COLUMN node_type TYPE node_type_new
  USING (
    CASE
      WHEN node_type::text = 'pp' THEN 'prp'::node_type_new
      WHEN node_type::text = 'ao' THEN 'ao'::node_type_new
      WHEN node_type::text = 'do_ls' THEN 'other'::node_type_new
      WHEN node_type::text = 'prp' THEN 'prp'::node_type_new
      WHEN node_type::text = 'sk' THEN 'sk'::node_type_new
      ELSE 'other'::node_type_new
    END
  );

-- Удаляем старый enum и переименовываем новый
DROP TYPE node_type;
ALTER TYPE node_type_new RENAME TO node_type;

-- Шаг 4: Пересоздаем функцию триггера с правильной логикой
DROP FUNCTION IF EXISTS set_node_type_from_code() CASCADE;

CREATE OR REPLACE FUNCTION set_node_type_from_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Определяем тип узла по префиксу кода
  IF NEW.code ~* '^ПРП' THEN
    NEW.node_type = 'prp';
  ELSIF NEW.code ~* '^АО' THEN
    NEW.node_type = 'ao';
  ELSIF NEW.code ~* '^СК' THEN
    NEW.node_type = 'sk';
  ELSE
    NEW.node_type = 'other';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер заново
CREATE TRIGGER trigger_set_node_type
  BEFORE INSERT OR UPDATE OF code ON zakaz_nodes
  FOR EACH ROW
  EXECUTE FUNCTION set_node_type_from_code();

-- Обновляем существующие записи с правильными типами
-- Обновляем код каждой записи, что заставит триггер пересчитать тип
UPDATE zakaz_nodes SET code = code;

-- Обновляем комментарий
COMMENT ON COLUMN zakaz_nodes.node_type IS 'Тип узла: prp - ПРП (узел связи), ao - АО (абонентское окончание), sk - СК (СКУД), other - прочее (РТК и др.)';
