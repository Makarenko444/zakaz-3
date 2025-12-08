-- Миграция: Добавление новых ролей пользователей
-- Дата: 2025-12-08
-- Описание: Добавление ролей: director, accountant, support, maintenance, approval

-- =====================================================
-- ДОБАВЛЕНИЕ НОВЫХ РОЛЕЙ В ENUM
-- =====================================================

-- Новые роли:
-- - director (Директор)
-- - accountant (Бухгалтер)
-- - support (Тех.поддержка)
-- - maintenance (Эксплуатация)
-- - approval (Согласование)

-- Добавляем новые значения в существующий enum
DO $$
BEGIN
    -- Добавляем director, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'director' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'director';
    END IF;

    -- Добавляем accountant, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accountant' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'accountant';
    END IF;

    -- Добавляем support, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'support' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'support';
    END IF;

    -- Добавляем maintenance, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'maintenance' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'maintenance';
    END IF;

    -- Добавляем approval, если его нет
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'approval' AND enumtypid = 'zakaz_user_role'::regtype) THEN
        ALTER TYPE zakaz_user_role ADD VALUE 'approval';
    END IF;
END $$;

-- Обновляем комментарий
COMMENT ON COLUMN zakaz_users.role IS 'Роль пользователя: admin, manager, engineer, installer, supply, director, accountant, support, maintenance, approval';

-- =====================================================
-- ИТОГИ МИГРАЦИИ
-- =====================================================

-- После выполнения:
-- 1. Добавлена роль director (Директор)
-- 2. Добавлена роль accountant (Бухгалтер)
-- 3. Добавлена роль support (Тех.поддержка)
-- 4. Добавлена роль maintenance (Эксплуатация)
-- 5. Добавлена роль approval (Согласование)
