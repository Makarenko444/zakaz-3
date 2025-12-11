-- SQL-запрос для поиска заявок где в комментариях есть менеджер, но assigned_to = NULL
-- Вариант 1: Поиск заявок где в комментариях есть пользователь с ролью 'manager',
-- но заявка не назначена

-- Сначала посмотрим список менеджеров
SELECT id, full_name, email, role
FROM zakaz_users
WHERE role = 'manager' AND active = true;

-- Вариант 2: Найти заявки где assigned_to IS NULL, но есть комментарии от менеджеров
SELECT DISTINCT
    a.id,
    a.application_number,
    a.customer_fullname,
    a.street_and_house,
    a.status,
    a.assigned_to,
    c.user_name AS comment_author,
    c.comment AS comment_text,
    c.created_at AS comment_date,
    u.role AS author_role
FROM zakaz_applications a
INNER JOIN zakaz_application_comments c ON c.application_id = a.id
LEFT JOIN zakaz_users u ON u.id = c.user_id
WHERE a.assigned_to IS NULL
  AND u.role = 'manager'
ORDER BY a.application_number DESC;

-- Вариант 3: Поиск в тексте комментариев по паттернам
-- (например "Взял в работу", "Менеджер:" и т.д.)
SELECT DISTINCT
    a.id,
    a.application_number,
    a.customer_fullname,
    a.street_and_house,
    a.status,
    a.assigned_to,
    c.user_name,
    c.comment,
    c.created_at
FROM zakaz_applications a
INNER JOIN zakaz_application_comments c ON c.application_id = a.id
WHERE a.assigned_to IS NULL
  AND (
    c.comment ILIKE '%взял в работу%' OR
    c.comment ILIKE '%взял заявку%' OR
    c.comment ILIKE '%менеджер%' OR
    c.comment ILIKE '%принял заявку%'
  )
ORDER BY a.application_number DESC;

-- Вариант 4: Поиск в legacy_body заявки
SELECT
    id,
    application_number,
    customer_fullname,
    street_and_house,
    status,
    assigned_to,
    legacy_body
FROM zakaz_applications
WHERE assigned_to IS NULL
  AND legacy_body IS NOT NULL
  AND (
    legacy_body ILIKE '%взял в работу%' OR
    legacy_body ILIKE '%менеджер%'
  )
ORDER BY application_number DESC;

-- Вариант 5: Полный анализ - заявки с комментариями, сгруппированные
WITH manager_comments AS (
    SELECT
        c.application_id,
        c.user_name,
        c.user_id,
        u.role,
        u.full_name as manager_name,
        u.id as manager_id,
        c.comment,
        c.created_at,
        ROW_NUMBER() OVER (PARTITION BY c.application_id ORDER BY c.created_at) as rn
    FROM zakaz_application_comments c
    LEFT JOIN zakaz_users u ON u.id = c.user_id
    WHERE u.role = 'manager'
)
SELECT
    a.application_number,
    a.customer_fullname,
    a.street_and_house,
    a.status,
    mc.manager_name,
    mc.manager_id,
    mc.comment,
    mc.created_at AS first_manager_comment_date
FROM zakaz_applications a
INNER JOIN manager_comments mc ON mc.application_id = a.id AND mc.rn = 1
WHERE a.assigned_to IS NULL
ORDER BY a.application_number DESC;
