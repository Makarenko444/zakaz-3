-- Миграция: Обновление ролей пользователей
-- Дата: 2025-11-20
-- Описание: Обновление списка допустимых ролей пользователей

-- =====================================================
-- ОБНОВЛЕНИЕ ENUM ТИПА
-- =====================================================

-- Старые роли в enum zakaz_user_role:
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

-- ВАЖНО: PostgreSQL не позволяет удалять значения из enum напрямую
-- Поэтому мы пересоздадим enum тип

-- 1. Добавляем новые значения в существующий enum (если их еще нет)
DO $$
BEGIN
    -- Добавляем manager, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'manager';
    END IF;

    -- Добавляем installer, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'installer' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'installer';
    END IF;

    -- Добавляем supply, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'supply' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'supply';
    END IF;
END $$;

-- 2. Обновляем существующие записи с устаревшими ролями
-- operator -> manager
UPDATE zakaz_users
SET role = 'manager'::zakaz_user_role
WHERE role = 'operator'::zakaz_user_role;

-- lead -> manager
UPDATE zakaz_users
SET role = 'manager'::zakaz_user_role
WHERE role = 'lead'::zakaz_user_role;

-- 3. Теперь пересоздаем enum, чтобы удалить старые значения
-- Создаем временный новый enum
DO $$
BEGIN
    -- Проверяем, не существует ли уже новый enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zakaz_user_role_new') THEN
        CREATE TYPE zakaz_user_role_new AS ENUM (
            'admin',
            'manager',
            'engineer',
            'installer',
            'supply'
        );
    END IF;
END $$;

-- 4. Изменяем тип колонки на новый enum
ALTER TABLE zakaz_users
ALTER COLUMN role TYPE zakaz_user_role_new
USING role::text::zakaz_user_role_new;

-- 5. Удаляем старый enum и переименовываем новый
DROP TYPE IF EXISTS zakaz_user_role;
ALTER TYPE zakaz_user_role_new RENAME TO zakaz_user_role;

-- 6. Обновляем комментарий
COMMENT ON COLUMN zakaz_users.role IS 'Роль пользователя: admin, manager, engineer, installer, supply';

-- =====================================================
-- ИТОГИ МИГРАЦИИ
-- =====================================================

-- После выполнения:
-- 1. Все пользователи с ролью 'operator' стали 'manager'
-- 2. Все пользователи с ролью 'lead' стали 'manager'
-- 3. Роли 'admin' и 'engineer' остались без изменений
-- 4. Добавлена возможность создавать пользователей с ролями 'installer' и 'supply'
-- 5. Enum zakaz_user_role содержит только актуальные роли
