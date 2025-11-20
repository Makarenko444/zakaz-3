-- Миграция 017: Обновление статусов заявок
-- 1. Объединение статусов "Договор" и "Ожидание оплаты" в "Договор и оплата"
-- 2. Добавление новых статусов "Проектирование" и "Согласование"

-- ====================================================================
-- Шаг 1: Обновляем все заявки со статусом waiting_payment на contract
-- ====================================================================
UPDATE zakaz_applications
SET status = 'contract'
WHERE status = 'waiting_payment';

-- ====================================================================
-- Шаг 2: Деактивируем старый статус waiting_payment
-- ====================================================================
UPDATE zakaz_application_statuses
SET is_active = FALSE,
    description_ru = 'УСТАРЕЛ: Объединен со статусом "Договор и оплата"'
WHERE code = 'waiting_payment';

-- ====================================================================
-- Шаг 3: Обновляем статус contract на новое название
-- ====================================================================
UPDATE zakaz_application_statuses
SET name_ru = 'Договор и оплата',
    description_ru = 'Заключение договора и ожидание/получение оплаты',
    sort_order = 4
WHERE code = 'contract';

-- ====================================================================
-- Шаг 4: Добавляем новые статусы
-- ====================================================================
INSERT INTO zakaz_application_statuses (code, name_ru, description_ru, sort_order, is_active) VALUES
    ('design', 'Проектирование', 'Разработка проекта подключения', 5, TRUE),
    ('approval', 'Согласование', 'Согласование проекта с клиентом', 6, TRUE)
ON CONFLICT (code) DO UPDATE SET
    name_ru = EXCLUDED.name_ru,
    description_ru = EXCLUDED.description_ru,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- ====================================================================
-- Шаг 5: Обновляем sort_order для последующих статусов
-- ====================================================================
UPDATE zakaz_application_statuses SET sort_order = 7 WHERE code = 'queue_install';
UPDATE zakaz_application_statuses SET sort_order = 8 WHERE code = 'install';
UPDATE zakaz_application_statuses SET sort_order = 9 WHERE code = 'installed';
UPDATE zakaz_application_statuses SET sort_order = 10 WHERE code = 'rejected';
UPDATE zakaz_application_statuses SET sort_order = 11 WHERE code = 'no_tech';

-- ====================================================================
-- Проверка результатов
-- ====================================================================
-- Показать все активные статусы в правильном порядке
SELECT code, name_ru, sort_order, is_active
FROM zakaz_application_statuses
WHERE is_active = TRUE
ORDER BY sort_order;

-- Итоговый порядок статусов:
-- 1. new - Новая
-- 2. thinking - Думает
-- 3. estimation - Расчёт
-- 4. contract - Договор и оплата (обновлено)
-- 5. design - Проектирование (новый)
-- 6. approval - Согласование (новый)
-- 7. queue_install - Очередь на монтаж
-- 8. install - Монтаж
-- 9. installed - Выполнено
-- 10. rejected - Отказ
-- 11. no_tech - Нет тех. возможности
