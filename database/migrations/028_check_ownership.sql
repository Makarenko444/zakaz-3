-- Проверка владельцев таблиц и пользователей

-- 1. Показать владельцев всех zakaz_* таблиц
SELECT
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename LIKE 'zakaz_%'
ORDER BY tablename;

-- 2. Показать всех пользователей БД
SELECT
  usename AS username,
  usesuper AS is_superuser,
  usecreatedb AS can_create_db
FROM pg_user
ORDER BY usename;

-- 3. Проверить текущего пользователя
SELECT current_user, session_user;

-- 4. Проверить структуру zakaz_nodes
\d zakaz_nodes

-- 5. Проверить структуру zakaz_applications
\d zakaz_applications

-- 6. Проверить количество записей с address_id
SELECT
  'zakaz_applications' as table_name,
  COUNT(*) as total,
  COUNT(address_id) as with_address_id,
  COUNT(*) - COUNT(address_id) as without_address_id
FROM zakaz_applications
UNION ALL
SELECT
  'zakaz_nodes' as table_name,
  COUNT(*) as total,
  COUNT(address_id) as with_address_id,
  COUNT(*) - COUNT(address_id) as without_address_id
FROM zakaz_nodes;
