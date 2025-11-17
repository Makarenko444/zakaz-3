-- Миграция 013: Разделение адреса на два поля для свободного ввода
-- Дата: 2025-11-17
-- Описание:
--   1. Добавление двух полей для ввода адреса: улица+дом и дополнительные данные
--   2. Удаление старого поля freeform_address и отдельных полей (entrance, floor, apartment)
--   3. Теперь адрес всегда вводится в два поля в свободной форме
--   4. Привязка к справочнику адресов происходит через мастера после создания заявки

-- Добавляем новые поля в таблицу заявок
ALTER TABLE zakaz_applications
  ADD COLUMN street_and_house TEXT,              -- Улица и номер дома
  ADD COLUMN address_details TEXT;               -- Подъезд, этаж, квартира/офис (свободная форма)

-- Мигрируем данные из старого поля freeform_address в новое поле street_and_house
UPDATE zakaz_applications
SET street_and_house = freeform_address
WHERE freeform_address IS NOT NULL;

-- Мигрируем данные из отдельных полей (entrance, floor, apartment) в address_details
UPDATE zakaz_applications
SET address_details = CONCAT_WS(', ',
  CASE WHEN entrance IS NOT NULL THEN 'подъезд ' || entrance END,
  CASE WHEN floor IS NOT NULL THEN 'этаж ' || floor END,
  CASE WHEN apartment IS NOT NULL THEN 'кв. ' || apartment END
)
WHERE entrance IS NOT NULL OR floor IS NOT NULL OR apartment IS NOT NULL;

-- Удаляем старые поля
ALTER TABLE zakaz_applications
  DROP COLUMN freeform_address,
  DROP COLUMN entrance,
  DROP COLUMN floor,
  DROP COLUMN apartment;

-- Добавляем комментарии к новым полям
COMMENT ON COLUMN zakaz_applications.street_and_house IS
  'Улица и номер дома в свободной форме (первое поле при создании заявки)';
COMMENT ON COLUMN zakaz_applications.address_details IS
  'Подъезд, этаж, квартира/офис в свободной форме (второе поле при создании заявки)';
