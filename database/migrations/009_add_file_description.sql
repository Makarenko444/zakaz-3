-- Добавление поля описания для файлов
ALTER TABLE zakaz_files
ADD COLUMN description TEXT;

-- Комментарий для документации
COMMENT ON COLUMN zakaz_files.description IS 'Описание файла, добавленное пользователем';
