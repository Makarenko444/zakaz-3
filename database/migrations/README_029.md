# Миграция 029: Изменения в таблице адресов

**Дата:** 2025-12-02 — 2025-12-04
**Автор:** Claude
**Статус:** Применена

## Описание

Миграция 029 состоит из двух частей:

### Часть 1: Статус присутствия (029_add_presence_status_to_addresses.sql)
Добавляет поле **presence_status** в таблицу `zakaz_addresses` для ручного управления статусом присутствия компании на адресе.

### Часть 2: Удаление автоматических префиксов (029_remove_address_prefixes.sql)
Убирает автоматическое добавление "д." перед номером дома в функции `format_address`. Теперь пользователь сам решает какие слова писать в полях адреса.

**До:** `format_address('Томск', 'ул. Ленина', '10', NULL)` → "Томск, ул. Ленина, д. 10"
**После:** `format_address('Томск', 'ул. Ленина', '10', NULL)` → "Томск, ул. Ленина, 10"

---

## Часть 1: Статус присутствия

## Изменения в структуре БД

### 1. Новый ENUM тип

```sql
CREATE TYPE address_presence_status AS ENUM (
  'has_node',              -- Есть узел
  'has_ao',                -- Есть АО (абонентское окончание)
  'has_transit_cable',     -- Есть транзитный кабель
  'collecting_collective', -- Собираем коллективную заявку
  'not_present'            -- Не присутствуем
);
```

### 2. Новое поле в zakaz_addresses

| Поле | Тип | Описание |
|------|-----|----------|
| `presence_status` | `address_presence_status` | Статус присутствия (по умолчанию 'not_present') |

### 3. Новый индекс

```sql
CREATE INDEX idx_addresses_presence_status ON zakaz_addresses(presence_status);
```

## Логика миграции

### Одноразовое заполнение данных

При первом применении миграции статус заполняется автоматически на основе **узлов** (`zakaz_nodes`):

```
1. Если есть узел с presence_type='has_node' → 'has_node'
2. Иначе если есть узел с 'has_ao' → 'has_ao'
3. Иначе если есть узел с 'has_transit_cable' → 'has_transit_cable'
4. Иначе → 'not_present'
```

**ВАЖНО:** После миграции статус редактируется **только вручную** через UI, автоматический пересчет больше не происходит!

## Применение миграции

### Шаг 1: Применить SQL

```bash
# Подключиться к БД
docker exec -it zakaz-postgres psql -U postgres -d zakaz

# Применить миграцию
\i /docker-entrypoint-initdb.d/migrations/029_add_presence_status_to_addresses.sql
```

### Шаг 2: Проверить результат

```sql
-- Проверить статистику
SELECT
  presence_status,
  COUNT(*) as count
FROM zakaz_addresses
GROUP BY presence_status
ORDER BY count DESC;

-- Примеры адресов с разными статусами
SELECT
  address,
  presence_status,
  (SELECT COUNT(*) FROM zakaz_nodes WHERE address_id = zakaz_addresses.id) as node_count
FROM zakaz_addresses
ORDER BY presence_status, address
LIMIT 20;
```

## Откат миграции

Если нужно откатить изменения:

```sql
DROP INDEX IF EXISTS idx_addresses_presence_status;
ALTER TABLE zakaz_addresses DROP COLUMN presence_status;
DROP TYPE address_presence_status;
```

## Влияние на код

### Изменения в API

1. **GET /api/addresses** - возвращает `presence_status` напрямую из поля
2. **PUT /api/addresses/[id]** - принимает и сохраняет `presence_status`
3. Убрана логика автоматического расчета статуса из узлов

### Изменения в UI

1. **Список адресов** - показывает статус из поля `presence_status`
2. **Форма редактирования адреса** - добавлен dropdown для выбора статуса (только для admin)

## Примеры использования

### Изменить статус адреса

```sql
-- Установить статус "Есть узел"
UPDATE zakaz_addresses
SET presence_status = 'has_node'
WHERE address = 'Томск, ул. Ленина, 10';

-- Установить статус "Собираем коллективную заявку"
UPDATE zakaz_addresses
SET presence_status = 'collecting_collective'
WHERE id = '123e4567-e89b-12d3-a456-426614174000';
```

### Найти все адреса со сбором коллективных заявок

```sql
SELECT address, comment, created_at
FROM zakaz_addresses
WHERE presence_status = 'collecting_collective'
ORDER BY created_at DESC;
```

## Преимущества нового подхода

✅ **Простота** - статус явно указан в таблице адресов
✅ **Гибкость** - можно установить любой статус вручную
✅ **Производительность** - не нужно JOIN с узлами для получения статуса
✅ **Понятность** - статус отражает реальную ситуацию, а не автоматический расчет
✅ **Новый статус** - добавлена возможность отметить "Собираем коллективную заявку"

## Статистика (после миграции)

```
=== Статистика по статусам присутствия ===
Всего адресов: XXX
Есть узел: XXX
Есть АО: XXX
Есть транзитный кабель: XXX
Собираем коллективную заявку: 0 (заполняется вручную)
Не присутствуем: XXX
```

---

## Часть 2: Удаление автоматических префиксов

### Изменения в функции format_address

Функция `format_address` теперь просто объединяет поля через запятую, без автоматического добавления префиксов:

```sql
CREATE OR REPLACE FUNCTION format_address(
  p_city VARCHAR,
  p_street VARCHAR,
  p_house VARCHAR,
  p_building VARCHAR
) RETURNS VARCHAR AS $$
BEGIN
  RETURN TRIM(
    CONCAT_WS(', ',
      NULLIF(p_city, ''),
      NULLIF(p_street, ''),
      NULLIF(p_house, ''),
      NULLIF(p_building, '')
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Применение

```bash
# Применить миграцию
docker exec -it zakaz-postgres psql -U postgres -d zakaz

\i /docker-entrypoint-initdb.d/migrations/029_remove_address_prefixes.sql
```

### Обновление существующих адресов

Миграция автоматически обновляет все существующие адреса:

```sql
UPDATE zakaz_addresses
SET address = format_address(city, street, house, building);
```

### Преимущества

✅ **Гибкость** - пользователь сам решает какие слова писать (д., ул., пр-т и т.д.)
✅ **Простота** - нет магии с автоматическим добавлением текста
✅ **Единообразие** - формат адреса полностью контролируется пользователем
