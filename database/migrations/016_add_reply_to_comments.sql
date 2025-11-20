-- Добавление поддержки ответов на комментарии
-- Миграция 016: Добавление поля reply_to_comment_id

-- Добавляем поле reply_to_comment_id (ссылка на родительский комментарий)
ALTER TABLE zakaz_application_comments
ADD COLUMN reply_to_comment_id UUID REFERENCES zakaz_application_comments(id) ON DELETE SET NULL;

-- Создаем индекс для оптимизации поиска ответов
CREATE INDEX idx_zakaz_application_comments_reply_to ON zakaz_application_comments(reply_to_comment_id);

-- Комментарий к полю
COMMENT ON COLUMN zakaz_application_comments.reply_to_comment_id IS 'ID комментария, на который отвечает данный комментарий';
