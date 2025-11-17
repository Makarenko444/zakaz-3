-- Миграция 011: Рефакторинг полей адреса
-- Дата: 2025-11-17
-- Описание:
--   1. Добавление полей для ввода адреса в свободной форме
--   2. Перенос дополнительных данных адреса из справочника в заявки
--   3. Справочник адресов теперь содержит только базовый адрес (улица + дом)
--   4. Дополнительные данные (подъезд, этаж, квартира) хранятся в заявках

-- Добавляем новые поля в таблицу заявок
ALTER TABLE zakaz_applications
  ADD COLUMN freeform_address TEXT,              -- Адрес в свободной форме
  ADD COLUMN entrance TEXT,                       -- Подъезд
  ADD COLUMN floor TEXT,                          -- Этаж
  ADD COLUMN apartment TEXT;                      -- Квартира

-- Делаем address_id необязательным, так как можно указать адрес в свободной форме
ALTER TABLE zakaz_applications
  ALTER COLUMN address_id DROP NOT NULL;

-- Переносим существующие данные из zakaz_addresses в zakaz_applications
UPDATE zakaz_applications a
SET entrance = addr.entrance
FROM zakaz_addresses addr
WHERE a.address_id = addr.id AND addr.entrance IS NOT NULL;

-- Удаляем поле entrance из справочника адресов (оставляем только базовый адрес)
ALTER TABLE zakaz_addresses
  DROP COLUMN IF EXISTS entrance;

-- Добавляем комментарий к таблице
COMMENT ON COLUMN zakaz_applications.freeform_address IS
  'Адрес в свободной форме. Используется при создании заявки, когда адреса нет в справочнике';
COMMENT ON COLUMN zakaz_applications.entrance IS
  'Подъезд (дополнительные данные адреса, хранятся только в заявке)';
COMMENT ON COLUMN zakaz_applications.floor IS
  'Этаж (дополнительные данные адреса, хранятся только в заявке)';
COMMENT ON COLUMN zakaz_applications.apartment IS
  'Квартира (дополнительные данные адреса, хранятся только в заявке)';
