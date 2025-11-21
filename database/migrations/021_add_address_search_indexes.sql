-- Миграция 021: Добавление индексов для поиска адресов
-- Дата: 2025-11-21
-- Описание:
--   Установка расширения pg_trgm для fuzzy поиска по адресам
--   и создание GIN индексов для быстрого поиска похожих адресов

-- Устанавливаем расширение pg_trgm (trigram) для fuzzy поиска
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Создаем GIN индекс для нечеткого поиска по полю street
CREATE INDEX IF NOT EXISTS idx_addresses_street_trgm
  ON zakaz_addresses USING gin(street gin_trgm_ops);

-- Создаем обычный индекс для точного поиска по номеру дома
CREATE INDEX IF NOT EXISTS idx_addresses_house
  ON zakaz_addresses(house);

-- Создаем составной индекс для комбинированного поиска
CREATE INDEX IF NOT EXISTS idx_addresses_street_house
  ON zakaz_addresses(street, house);

-- Добавляем комментарии
COMMENT ON INDEX idx_addresses_street_trgm IS
  'GIN индекс для нечеткого (fuzzy) поиска по названию улицы с использованием триграмм';
COMMENT ON INDEX idx_addresses_house IS
  'Индекс для быстрого точного поиска по номеру дома';
COMMENT ON INDEX idx_addresses_street_house IS
  'Составной индекс для комбинированного поиска по улице и дому';
