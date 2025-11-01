-- Таблица логов аудита (история всех действий в системе)
CREATE TABLE IF NOT EXISTS zakaz_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Кто совершил действие
    user_id UUID REFERENCES zakaz_users(id) ON DELETE SET NULL,
    user_email TEXT, -- Дублируем email на случай удаления пользователя
    user_name TEXT,  -- Дублируем имя на случай удаления пользователя

    -- Что произошло
    action_type TEXT NOT NULL, -- 'create', 'update', 'delete', 'status_change', 'assign', etc.
    entity_type TEXT NOT NULL, -- 'application', 'address', 'user', etc.
    entity_id UUID,             -- ID сущности (заявки, адреса и т.д.)

    -- Описание действия
    description TEXT NOT NULL,  -- Человекочитаемое описание

    -- Детали изменений (JSON)
    old_values JSONB,           -- Старые значения
    new_values JSONB,           -- Новые значения

    -- Дополнительная информация
    ip_address INET,            -- IP адрес пользователя
    user_agent TEXT,            -- Браузер/устройство

    -- Временная метка
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON zakaz_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON zakaz_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON zakaz_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON zakaz_audit_log(created_at DESC);

-- Комментарии к таблице
COMMENT ON TABLE zakaz_audit_log IS 'Журнал аудита всех действий в системе';
COMMENT ON COLUMN zakaz_audit_log.action_type IS 'Тип действия: create, update, delete, status_change, assign, etc.';
COMMENT ON COLUMN zakaz_audit_log.entity_type IS 'Тип сущности: application, address, user, etc.';
COMMENT ON COLUMN zakaz_audit_log.description IS 'Человекочитаемое описание действия для отображения в интерфейсе';
COMMENT ON COLUMN zakaz_audit_log.old_values IS 'JSON с предыдущими значениями полей';
COMMENT ON COLUMN zakaz_audit_log.new_values IS 'JSON с новыми значениями полей';

-- Права доступа
GRANT SELECT, INSERT ON zakaz_audit_log TO service_role;
GRANT SELECT ON zakaz_audit_log TO authenticated;

-- Функция для автоматического логирования (опционально, можем использовать позже)
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id UUID,
    p_user_email TEXT,
    p_user_name TEXT,
    p_action_type TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_description TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO zakaz_audit_log (
        user_id,
        user_email,
        user_name,
        action_type,
        entity_type,
        entity_id,
        description,
        old_values,
        new_values
    ) VALUES (
        p_user_id,
        p_user_email,
        p_user_name,
        p_action_type,
        p_entity_type,
        p_entity_id,
        p_description,
        p_old_values,
        p_new_values
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Права на функцию
GRANT EXECUTE ON FUNCTION log_audit TO service_role;
