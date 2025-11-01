-- Таблица комментариев сотрудников к заявкам
CREATE TABLE IF NOT EXISTS zakaz_application_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- К какой заявке относится
    application_id UUID NOT NULL REFERENCES zakaz_applications(id) ON DELETE CASCADE,

    -- Кто оставил комментарий
    user_id UUID REFERENCES zakaz_users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL, -- Дублируем имя на случай удаления пользователя
    user_email TEXT,         -- Email для отображения

    -- Текст комментария
    comment TEXT NOT NULL,

    -- Временные метки
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_comments_application_id ON zakaz_application_comments(application_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON zakaz_application_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON zakaz_application_comments(created_at DESC);

-- Комментарии к таблице
COMMENT ON TABLE zakaz_application_comments IS 'Комментарии сотрудников к заявкам';
COMMENT ON COLUMN zakaz_application_comments.application_id IS 'ID заявки к которой относится комментарий';
COMMENT ON COLUMN zakaz_application_comments.comment IS 'Текст комментария от сотрудника';

-- Права доступа
GRANT SELECT, INSERT, UPDATE, DELETE ON zakaz_application_comments TO service_role;
GRANT SELECT ON zakaz_application_comments TO authenticated;

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_zakaz_application_comments_updated_at
    BEFORE UPDATE ON zakaz_application_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
