-- Миграция 023: Добавление уникального constraint для адресов
-- Дата: 2025-11-21
-- Описание:
--   Добавляем уникальный constraint на комбинацию street + house
--   чтобы избежать дубликатов при сохранении адресов из внешних источников

-- Сначала удаляем возможные дубликаты
-- (оставляем только первый адрес, остальные удаляем)
DELETE FROM zakaz_addresses a
USING zakaz_addresses b
WHERE a.id > b.id
  AND a.street = b.street
  AND a.house = b.house;

-- Добавляем уникальный constraint
ALTER TABLE zakaz_addresses
  ADD CONSTRAINT zakaz_addresses_street_house_unique
  UNIQUE (street, house);

-- Добавляем комментарий
COMMENT ON CONSTRAINT zakaz_addresses_street_house_unique ON zakaz_addresses IS
  'Уникальность комбинации улица + дом. Предотвращает дубликаты при импорте из внешних источников.';
