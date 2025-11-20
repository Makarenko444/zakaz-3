-- Миграция: Обновление ролей пользователей - Шаг 1
-- Дата: 2025-11-20
-- Описание: Добавление новых значений в ENUM zakaz_user_role

-- =====================================================
-- ШАГ 1: Добавление новых значений в enum
-- =====================================================

-- Добавляем manager
ALTER TYPE zakaz_user_role ADD VALUE IF NOT EXISTS 'manager';

-- Добавляем installer
ALTER TYPE zakaz_user_role ADD VALUE IF NOT EXISTS 'installer';

-- Добавляем supply
ALTER TYPE zakaz_user_role ADD VALUE IF NOT EXISTS 'supply';

-- =====================================================
-- ВАЖНО: После выполнения этого шага необходимо
-- дождаться фиксации изменений (COMMIT)
-- Затем выполнить шаг 2: 014_update_user_roles_step2.sql
-- =====================================================
