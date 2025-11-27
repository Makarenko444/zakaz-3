-- Диагностика проблемы с zakaz_applications

-- 1. Проверяем типы данных в таблицах
SELECT
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name IN ('zakaz_applications', 'zakaz_nodes')
  AND column_name IN ('id', 'node_id', 'address_id')
ORDER BY table_name, column_name;

-- 2. Показываем несколько заявок
SELECT
  id,
  node_id,
  address_id,
  street_and_house,
  address_match_status,
  application_number
FROM zakaz_applications
ORDER BY created_at DESC
LIMIT 5;

-- 3. Показываем несколько узлов
SELECT
  id,
  code,
  address_id
FROM zakaz_nodes
ORDER BY created_at DESC
LIMIT 5;

-- 4. Проверяем, есть ли связь между applications и nodes
SELECT
  'Заявок всего' as metric,
  COUNT(*) as count
FROM zakaz_applications
UNION ALL
SELECT
  'Заявок с node_id IS NOT NULL',
  COUNT(*)
FROM zakaz_applications
WHERE node_id IS NOT NULL
UNION ALL
SELECT
  'Заявок с node_id > 0',
  COUNT(*)
FROM zakaz_applications
WHERE node_id::text != '' AND node_id IS NOT NULL;

-- 5. Попытка найти соответствия (если node_id это BIGINT)
SELECT
  app.id as app_id,
  app.node_id,
  app.street_and_house,
  n.id as node_id_found,
  n.code,
  n.address_id
FROM zakaz_applications app
LEFT JOIN zakaz_nodes n ON n.id = app.node_id
LIMIT 5;
