-- Очистка базы данных от неиспользуемых таблиц
-- Дата: 2025-11-14
-- Описание: Удаление устаревших и неиспользуемых таблиц

-- =====================================================
-- УДАЛЕНИЕ УСТАРЕВШИХ ТАБЛИЦ (заменены новыми)
-- =====================================================

-- 1. zakaz_comments -> заменена на zakaz_application_comments
DROP TABLE IF EXISTS zakaz_comments CASCADE;

-- 2. zakaz_comment_files -> не используется (0 строк)
DROP TABLE IF EXISTS zakaz_comment_files CASCADE;

-- 3. zakaz_application_files -> не используется (0 строк)
DROP TABLE IF EXISTS zakaz_application_files CASCADE;

-- =====================================================
-- УДАЛЕНИЕ ТАБЛИЦ НЕРЕАЛИЗОВАННЫХ ФУНКЦИЙ
-- =====================================================

-- 4. zakaz_work_slots -> планирование работ не реализовано (0 строк)
DROP TABLE IF EXISTS zakaz_work_slots CASCADE;

-- 5. zakaz_brigade_members -> управление бригадами не реализовано (1 строка)
DROP TABLE IF EXISTS zakaz_brigade_members CASCADE;

-- 6. zakaz_brigades -> монтажные бригады не реализованы (1 строка)
DROP TABLE IF EXISTS zakaz_brigades CASCADE;

-- =====================================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ
-- =====================================================

-- Вывести список оставшихся таблиц
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'zakaz_%'
ORDER BY tablename;

-- Подсчитать количество записей в активных таблицах
SELECT
  'zakaz_addresses' as table_name, COUNT(*) as row_count FROM zakaz_addresses
UNION ALL
SELECT 'zakaz_application_comments', COUNT(*) FROM zakaz_application_comments
UNION ALL
SELECT 'zakaz_application_status_history', COUNT(*) FROM zakaz_application_status_history
UNION ALL
SELECT 'zakaz_application_statuses', COUNT(*) FROM zakaz_application_statuses
UNION ALL
SELECT 'zakaz_applications', COUNT(*) FROM zakaz_applications
UNION ALL
SELECT 'zakaz_audit_log', COUNT(*) FROM zakaz_audit_log
UNION ALL
SELECT 'zakaz_files', COUNT(*) FROM zakaz_files
UNION ALL
SELECT 'zakaz_sessions', COUNT(*) FROM zakaz_sessions
UNION ALL
SELECT 'zakaz_users', COUNT(*) FROM zakaz_users
ORDER BY table_name;
