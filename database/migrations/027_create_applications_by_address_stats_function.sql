-- Создание функции для получения статистики заявок по адресам

CREATE OR REPLACE FUNCTION get_applications_by_address_stats()
RETURNS TABLE (
  node_id UUID,
  address TEXT,
  city TEXT,
  street TEXT,
  house TEXT,
  building TEXT,
  status TEXT,
  status_name TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS node_id,
    n.address,
    n.city,
    n.street,
    n.house,
    n.building,
    a.status::TEXT AS status,
    s.name_ru AS status_name,
    COUNT(a.id) AS count
  FROM zakaz_nodes n
  INNER JOIN zakaz_applications a ON a.node_id = n.id
  INNER JOIN application_statuses s ON s.code = a.status::TEXT
  WHERE a.status IS NOT NULL
  GROUP BY n.id, n.address, n.city, n.street, n.house, n.building, a.status, s.name_ru
  ORDER BY n.address, s.sort_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_applications_by_address_stats() IS 'Возвращает статистику заявок по адресам с разбивкой по статусам';
