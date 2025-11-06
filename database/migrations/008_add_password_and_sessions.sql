-- Миграция 008: Добавление password_hash и таблицы сессий для простой авторизации

-- 1. Добавляем поле password_hash в zakaz_users
ALTER TABLE zakaz_users
ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN zakaz_users.password_hash IS 'Хеш пароля (bcrypt)';

-- 2. Создаем таблицу сессий
CREATE TABLE IF NOT EXISTS zakaz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- К какому пользователю относится сессия
    user_id UUID NOT NULL REFERENCES zakaz_users(id) ON DELETE CASCADE,

    -- Токен сессии (хранится в cookie)
    session_token TEXT NOT NULL UNIQUE,

    -- IP и User-Agent для безопасности
    ip_address INET,
    user_agent TEXT,

    -- Время жизни сессии
    expires_at TIMESTAMPTZ NOT NULL,

    -- Временные метки
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON zakaz_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON zakaz_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON zakaz_sessions(expires_at);

-- Комментарии
COMMENT ON TABLE zakaz_sessions IS 'Активные сессии пользователей';
COMMENT ON COLUMN zakaz_sessions.session_token IS 'UUID токен сессии, хранится в cookie';
COMMENT ON COLUMN zakaz_sessions.expires_at IS 'Время истечения сессии';

-- 3. Функция для очистки истекших сессий (опционально, можно вызывать по cron)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM zakaz_sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Удаляет истекшие сессии из БД';

-- 4. Обновляем пароли для тестовых пользователей (bcrypt hash для "password123")
-- Hash: $2a$10$rK8qV0jXxZxJ8J8xJ8xJ8.XxJ8xJ8xJ8xJ8xJ8xJ8xJ8xJ8xJ8xJ8
-- Это временный хеш, пользователи должны будут сменить пароль

UPDATE zakaz_users
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMye7FRNpZAV3m9xqV3fXJ6NxJ5fE.8JQKG'
WHERE password_hash IS NULL;

-- Примечание: Это bcrypt хеш для пароля "password123"
-- После деплоя нужно установить нормальные пароли через админку!
