-- Миграция 020: Добавление статуса привязки адреса
-- Дата: 2025-11-21
-- Описание:
--   Добавление поля address_match_status для отслеживания статуса привязки
--   заявки к формализованному адресу из справочника.
--   Возможные значения:
--   - unmatched: адрес не привязан к справочнику
--   - auto_matched: адрес привязан автоматически (резерв на будущее)
--   - manual_matched: адрес привязан вручную менеджером

-- Создаем enum для статуса привязки адреса
CREATE TYPE address_match_status AS ENUM ('unmatched', 'auto_matched', 'manual_matched');

-- Добавляем поле в таблицу заявок
ALTER TABLE zakaz_applications
  ADD COLUMN address_match_status address_match_status DEFAULT 'unmatched' NOT NULL;

-- Обновляем статус для существующих заявок с привязанным адресом
UPDATE zakaz_applications
SET address_match_status = 'manual_matched'
WHERE address_id IS NOT NULL;

-- Добавляем комментарий к полю
COMMENT ON COLUMN zakaz_applications.address_match_status IS
  'Статус привязки заявки к формализованному адресу: unmatched - не привязан, auto_matched - автоматически, manual_matched - вручную менеджером';

-- Создаем индекс для быстрого поиска непривязанных заявок
CREATE INDEX idx_applications_match_status ON zakaz_applications(address_match_status)
  WHERE address_match_status = 'unmatched';
