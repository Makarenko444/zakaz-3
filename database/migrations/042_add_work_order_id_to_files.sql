-- Миграция 042: Добавление work_order_id в таблицу файлов
-- Дата: 2024-12-12

-- Добавляем колонку work_order_id
ALTER TABLE zakaz_files
ADD COLUMN IF NOT EXISTS work_order_id UUID REFERENCES zakaz_work_orders(id) ON DELETE SET NULL;

-- Индекс для поиска файлов наряда
CREATE INDEX IF NOT EXISTS idx_zakaz_files_work_order ON zakaz_files(work_order_id)
    WHERE work_order_id IS NOT NULL;

-- Комментарий к колонке
COMMENT ON COLUMN zakaz_files.work_order_id IS 'Ссылка на наряд (файлы наряда)';
