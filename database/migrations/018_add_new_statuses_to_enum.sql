-- Миграция 018: Добавление новых статусов в enum zakaz_application_status
-- Добавляет значения 'design' и 'approval' в enum тип

-- ====================================================================
-- Добавляем новые значения в enum
-- ====================================================================
ALTER TYPE zakaz_application_status ADD VALUE IF NOT EXISTS 'design';
ALTER TYPE zakaz_application_status ADD VALUE IF NOT EXISTS 'approval';

-- ====================================================================
-- Проверка результатов
-- ====================================================================
-- Показать все значения enum
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'zakaz_application_status'::regtype
ORDER BY enumsortorder;

-- Ожидаемый результат:
-- new
-- thinking
-- estimation
-- waiting_payment
-- contract
-- design (новый)
-- approval (новый)
-- queue_install
-- install
-- installed
-- rejected
-- no_tech
