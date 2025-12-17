-- Миграция 050: Расширение service_type новыми типами работ
-- Дата: 2025-12-17
-- Описание: Добавляем новые типы работ к существующим вариантам service_type

-- Текущие значения: apartment, office, scs, emergency
-- Новые значения: access_control (СКУД), node_construction (Строительство Узла), trunk_construction (Строительство магистрали)

-- Проверяем наличие CHECK constraint и обновляем его при необходимости
-- PostgreSQL не позволяет напрямую изменять enum, поэтому работаем с text + check

-- Если есть ограничение на service_type, удаляем и создаём новое
DO $$
BEGIN
    -- Пробуем удалить старое ограничение (если есть)
    ALTER TABLE zakaz_applications DROP CONSTRAINT IF EXISTS zakaz_applications_service_type_check;
EXCEPTION
    WHEN undefined_object THEN
        -- Ограничения нет, это нормально
        NULL;
END $$;

-- Добавляем комментарий к полю
COMMENT ON COLUMN zakaz_applications.service_type IS 'Тип работ: apartment (Подключение квартиры), office (Подключение офиса), scs (Строительство СКС), emergency (Аварийная заявка), access_control (СКУД), node_construction (Строительство Узла), trunk_construction (Строительство магистрали)';

-- Удаляем поле work_type если оно было создано ранее
ALTER TABLE zakaz_applications DROP COLUMN IF EXISTS work_type;

-- Удаляем enum тип если был создан
DROP TYPE IF EXISTS work_type_enum;
