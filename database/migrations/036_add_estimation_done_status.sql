-- Миграция 036: Добавление статуса "Расчет выполнен"
-- Новый статус идёт после "Расчёт" (estimation)

-- ====================================================================
-- Шаг 0: Добавляем значение в enum тип PostgreSQL
-- ====================================================================
ALTER TYPE zakaz_application_status ADD VALUE IF NOT EXISTS 'estimation_done' AFTER 'estimation';

-- ====================================================================
-- Шаг 1: Сдвигаем sort_order для всех статусов начиная с contract
-- ====================================================================
UPDATE zakaz_application_statuses SET sort_order = sort_order + 1 WHERE sort_order >= 4;

-- ====================================================================
-- Шаг 2: Добавляем новый статус "Расчет выполнен"
-- ====================================================================
INSERT INTO zakaz_application_statuses (code, name_ru, description_ru, sort_order, is_active) VALUES
    ('estimation_done', 'Расчёт выполнен', 'Расчёт стоимости выполнен, ожидает отправки клиенту', 4, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name_ru = EXCLUDED.name_ru,
    description_ru = EXCLUDED.description_ru,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ====================================================================
-- Проверка результатов
-- ====================================================================
SELECT code, name_ru, sort_order, is_active
FROM zakaz_application_statuses
WHERE is_active = TRUE
ORDER BY sort_order;

-- Итоговый порядок статусов:
-- 1. new - Новая
-- 2. thinking - Думает
-- 3. estimation - Расчёт
-- 4. estimation_done - Расчёт выполнен (новый)
-- 5. contract - Договор и оплата
-- 6. design - Проектирование
-- 7. approval - Согласование
-- 8. queue_install - Очередь на монтаж
-- 9. install - Монтаж
-- 10. installed - Выполнено
-- 11. rejected - Отказ
-- 12. no_tech - Нет тех. возможности
