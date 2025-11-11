-- Удаление таблицы если существует (очистка)
DROP TABLE IF EXISTS zakaz_files CASCADE;

-- Создание таблицы файлов
CREATE TABLE zakaz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,
  comment_id UUID,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Добавление внешних ключей
ALTER TABLE zakaz_files
  ADD CONSTRAINT fk_application
  FOREIGN KEY (application_id)
  REFERENCES zakaz_applications(id)
  ON DELETE CASCADE;

ALTER TABLE zakaz_files
  ADD CONSTRAINT fk_comment
  FOREIGN KEY (comment_id)
  REFERENCES zakaz_comments(id)
  ON DELETE CASCADE;

ALTER TABLE zakaz_files
  ADD CONSTRAINT fk_user
  FOREIGN KEY (uploaded_by)
  REFERENCES zakaz_users(id);

-- Индексы для производительности
CREATE INDEX idx_zakaz_files_application_id ON zakaz_files(application_id);
CREATE INDEX idx_zakaz_files_comment_id ON zakaz_files(comment_id);
CREATE INDEX idx_zakaz_files_uploaded_by ON zakaz_files(uploaded_by);
CREATE INDEX idx_zakaz_files_uploaded_at ON zakaz_files(uploaded_at DESC);
CREATE INDEX idx_zakaz_files_stored_filename ON zakaz_files(stored_filename);

-- Комментарии для документации
COMMENT ON TABLE zakaz_files IS 'Метаданные прикрепленных файлов к заявкам и комментариям';
COMMENT ON COLUMN zakaz_files.application_id IS 'ID заявки, к которой прикреплен файл';
COMMENT ON COLUMN zakaz_files.comment_id IS 'ID комментария, к которому прикреплен файл (NULL если файл прикреплен к заявке напрямую)';
COMMENT ON COLUMN zakaz_files.original_filename IS 'Оригинальное имя файла, загруженное пользователем';
COMMENT ON COLUMN zakaz_files.stored_filename IS 'Уникальное имя файла на сервере';
COMMENT ON COLUMN zakaz_files.file_size IS 'Размер файла в байтах';
COMMENT ON COLUMN zakaz_files.mime_type IS 'MIME тип файла (например, application/pdf, image/jpeg)';
COMMENT ON COLUMN zakaz_files.uploaded_by IS 'ID пользователя, загрузившего файл';
COMMENT ON COLUMN zakaz_files.uploaded_at IS 'Дата и время загрузки файла';
