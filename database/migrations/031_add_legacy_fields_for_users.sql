-- Миграция: Добавление полей для импорта пользователей из старой системы
-- Дата: 2024-12-05

-- Добавляем legacy поля в таблицу пользователей
ALTER TABLE zakaz_users
ADD COLUMN IF NOT EXISTS legacy_uid INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS legacy_last_access TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS legacy_last_login TIMESTAMP WITH TIME ZONE;

-- Индекс для быстрого поиска по legacy_uid
CREATE INDEX IF NOT EXISTS idx_users_legacy_uid ON zakaz_users(legacy_uid) WHERE legacy_uid IS NOT NULL;

-- Комментарии к полям
COMMENT ON COLUMN zakaz_users.legacy_uid IS 'ID пользователя из старой системы Drupal (uid)';
COMMENT ON COLUMN zakaz_users.legacy_last_access IS 'Последний визит в старой системе';
COMMENT ON COLUMN zakaz_users.legacy_last_login IS 'Последняя авторизация в старой системе';
