-- Миграция: Обновление ролей пользователей
-- Дата: 2025-11-20
-- Описание: Обновление списка допустимых ролей пользователей

-- =====================================================
-- ОБНОВЛЕНИЕ РОЛЕЙ
-- =====================================================

-- Старые роли:
-- - admin (Администратор) - сохраняется
-- - operator (Оператор) - заменяется на manager
-- - engineer (Инженер) - сохраняется
-- - lead (Руководитель) - удаляется

-- Новые роли:
-- - admin (Администратор)
-- - manager (Менеджер)
-- - engineer (Инженер)
-- - installer (Монтажник)
-- - supply (Снабжение)

-- 1. Сначала удаляем старый CHECK constraint (если существует)
DO $$
BEGIN
    -- Удаляем constraint если он существует
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'zakaz_users_role_check'
    ) THEN
        ALTER TABLE zakaz_users DROP CONSTRAINT zakaz_users_role_check;
    END IF;
END $$;

-- 2. Обновляем существующие записи с устаревшими ролями
-- operator -> manager
UPDATE zakaz_users
SET role = 'manager'
WHERE role = 'operator';

-- lead -> manager (руководитель становится менеджером)
UPDATE zakaz_users
SET role = 'manager'
WHERE role = 'lead';

-- 3. Добавляем новый CHECK constraint с обновленным списком ролей
ALTER TABLE zakaz_users
ADD CONSTRAINT zakaz_users_role_check
CHECK (role IN ('admin', 'manager', 'engineer', 'installer', 'supply'));

-- =====================================================
-- ИТОГИ МИГРАЦИИ
-- =====================================================

-- После выполнения:
-- 1. Все пользователи с ролью 'operator' стали 'manager'
-- 2. Все пользователи с ролью 'lead' стали 'manager'
-- 3. Роли 'admin' и 'engineer' остались без изменений
-- 4. Добавлена возможность создавать пользователей с ролями 'installer' и 'supply'

COMMENT ON COLUMN zakaz_users.role IS 'Роль пользователя: admin, manager, engineer, installer, supply';
