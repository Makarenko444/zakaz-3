-- Миграция: Обновление ролей пользователей - Шаг 2
-- Дата: 2025-11-20
-- Описание: Обновление данных и очистка старых значений

-- =====================================================
-- ШАГ 2: Обновление существующих записей
-- =====================================================

-- ВАЖНО: Перед выполнением этого шага убедитесь,
-- что шаг 1 (014_update_user_roles_step1.sql) выполнен
-- и изменения зафиксированы (COMMIT)

-- Обновляем operator -> manager
UPDATE zakaz_users
SET role = 'manager'::zakaz_user_role
WHERE role = 'operator'::zakaz_user_role;

-- Обновляем lead -> manager
UPDATE zakaz_users
SET role = 'manager'::zakaz_user_role
WHERE role = 'lead'::zakaz_user_role;

-- =====================================================
-- ШАГ 3: Пересоздание enum для удаления старых значений
-- =====================================================

-- Создаем новый временный enum
CREATE TYPE zakaz_user_role_new AS ENUM (
    'admin',
    'manager',
    'engineer',
    'installer',
    'supply'
);

-- Изменяем тип колонки
ALTER TABLE zakaz_users
ALTER COLUMN role TYPE zakaz_user_role_new
USING role::text::zakaz_user_role_new;

-- Удаляем старый enum
DROP TYPE zakaz_user_role;

-- Переименовываем новый enum
ALTER TYPE zakaz_user_role_new RENAME TO zakaz_user_role;

-- Обновляем комментарий
COMMENT ON COLUMN zakaz_users.role IS 'Роль пользователя: admin, manager, engineer, installer, supply';

-- =====================================================
-- ИТОГИ МИГРАЦИИ
-- =====================================================

-- После выполнения обоих шагов:
-- 1. Все пользователи с ролью 'operator' стали 'manager'
-- 2. Все пользователи с ролью 'lead' стали 'manager'
-- 3. Роли 'admin' и 'engineer' остались без изменений
-- 4. Enum содержит только актуальные роли: admin, manager, engineer, installer, supply
