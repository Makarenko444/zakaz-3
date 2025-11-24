# Миграция 025: Добавление полей city и building

**Дата:** 2025-11-24
**Статус:** Готова к применению

## Описание

Разбиваем адрес на более детальные компоненты для лучшей структуризации данных.

### До миграции:
```
zakaz_nodes:
  - street (улица)
  - house (дом)
  - address (автоматически: "улица, дом")
```

### После миграции:
```
zakaz_nodes:
  - city (город)
  - street (улица)
  - house (дом)
  - building (строение/корпус)
  - address (автоматически: "город, улица, д. X, корп. Y")
```

## Изменения

### 1. Новые поля
- `city VARCHAR(200)` - название города
- `building VARCHAR(50)` - строение/корпус (опционально)

### 2. Функция format_node_address()
Создана PostgreSQL функция для автоматического формирования полного адреса:
```sql
format_node_address(city, street, house, building)
-- Возвращает: "Москва, ул. Ленина, д. 10, корп. 2"
```

### 3. Триггер update_node_address
Автоматически обновляет поле `address` при изменении любого компонента адреса.

### 4. Индексы
- `idx_zakaz_nodes_city` - для фильтрации по городу
- `idx_zakaz_nodes_city_street` - для комбинированного поиска

## Применение миграции

```bash
psql -U postgres -d zakaz3 -f database/migrations/025_add_city_and_building_fields.sql
```

## Проверка

```sql
-- Проверяем новые поля
SELECT city, street, house, building, address
FROM zakaz_nodes
LIMIT 5;

-- Проверяем работу триггера
UPDATE zakaz_nodes
SET building = 'корп. 1'
WHERE id = 'какой-то-id';

SELECT address FROM zakaz_nodes WHERE id = 'какой-то-id';
-- Должно автоматически обновиться
```

## Примеры использования

### Создание нового узла:
```sql
INSERT INTO zakaz_nodes (code, city, street, house, building, status, presence_type)
VALUES ('NODE-XXX', 'Москва', 'ул. Ленина', '10', 'корп. 2', 'existing', 'has_node');
-- address автоматически = "Москва, ул. Ленина, д. 10, корп. 2"
```

### Без корпуса:
```sql
INSERT INTO zakaz_nodes (code, city, street, house, status, presence_type)
VALUES ('NODE-YYY', 'Санкт-Петербург', 'Невский проспект', '1', 'existing', 'has_node');
-- address автоматически = "Санкт-Петербург, Невский проспект, д. 1"
```

## Преимущества

✅ **Структурированные данные** - каждый компонент адреса в отдельном поле
✅ **Масштабируемость** - легко добавить поддержку нескольких городов
✅ **Фильтрация** - можно фильтровать и группировать по городам
✅ **Точность** - поддержка корпусов и строений
✅ **Автоматизация** - поле address обновляется автоматически

## Откат миграции

```sql
-- Удаляем триггер и функцию
DROP TRIGGER IF EXISTS trigger_update_node_address ON zakaz_nodes;
DROP FUNCTION IF EXISTS update_node_address();
DROP FUNCTION IF EXISTS format_node_address(VARCHAR, VARCHAR, VARCHAR, VARCHAR);

-- Удаляем индексы
DROP INDEX IF EXISTS idx_zakaz_nodes_city;
DROP INDEX IF EXISTS idx_zakaz_nodes_city_street;

-- Удаляем поля
ALTER TABLE zakaz_nodes
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS building;
```

## Следующие шаги

После применения миграции в БД необходимо обновить:
1. ✅ TypeScript типы в `lib/types.ts`
2. ✅ API endpoints для создания/редактирования узлов
3. ✅ UI компоненты для отображения и редактирования
4. ✅ Формы создания/редактирования узлов
