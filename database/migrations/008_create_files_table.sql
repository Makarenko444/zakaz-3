-- Миграция: Создание таблицы для хранения файлов
-- Дата: 2025-11-10
-- Описание: Таблица для хранения метаданных прикрепленных файлов к заявкам и комментариям

-- Создание таблицы файлов
CREATE TABLE IF NOT EXISTS zakaz_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Связь с заявкой (обязательно)
  application_id UUID NOT NULL REFERENCES zakaz_applications(id) ON DELETE CASCADE,

  -- Связь с комментарием (опционально - NULL если файл прикреплен к заявке напрямую)
  comment_id UUID REFERENCES zakaz_comments(id) ON DELETE CASCADE,

  -- Информация о файле
  original_filename TEXT NOT NULL,           -- Оригинальное имя файла
  stored_filename TEXT NOT NULL UNIQUE,      -- Имя файла на сервере (уникальное)
  file_size BIGINT NOT NULL,                 -- Размер файла в байтах
  mime_type TEXT NOT NULL,                   -- MIME тип файла

  -- Метаданные
  uploaded_by UUID NOT NULL REFERENCES zakaz_users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Индексы
  CONSTRAINT fk_application FOREIGN KEY (application_id) REFERENCES zakaz_applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_comment FOREIGN KEY (comment_id) REFERENCES zakaz_comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (uploaded_by) REFERENCES zakaz_users(id)
);

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
