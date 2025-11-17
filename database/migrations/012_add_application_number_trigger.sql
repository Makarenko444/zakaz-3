-- Миграция 012: Добавление автогенерации номера заявки
-- Дата: 2025-11-17
-- Описание: Создает последовательность и триггер для автоматической генерации application_number

-- Создаем последовательность для номеров заявок, начиная с 1
CREATE SEQUENCE IF NOT EXISTS zakaz_applications_number_seq START WITH 1;

-- Функция для генерации номера заявки
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Если application_number не указан, генерируем его автоматически
  IF NEW.application_number IS NULL THEN
    NEW.application_number := nextval('zakaz_applications_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер, который вызывается BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_generate_application_number ON zakaz_applications;
CREATE TRIGGER trigger_generate_application_number
  BEFORE INSERT ON zakaz_applications
  FOR EACH ROW
  EXECUTE FUNCTION generate_application_number();

-- Обновляем существующие записи без номера
UPDATE zakaz_applications
SET application_number = nextval('zakaz_applications_number_seq')
WHERE application_number IS NULL;

-- Добавляем комментарий
COMMENT ON COLUMN zakaz_applications.application_number IS
  'Уникальный номер заявки, генерируется автоматически через триггер';
