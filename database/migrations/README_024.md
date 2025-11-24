# Миграция 024: Объединение таблиц адресов и узлов связи

**Дата:** 2025-11-24
**Автор:** Claude AI
**Статус:** Готова к применению

## Обзор

Эта миграция объединяет две ранее отдельные таблицы:
- `zakaz_addresses` (справочник адресов)
- `zakaz_nodes` (узлы связи)

в единую таблицу `zakaz_nodes`, что упрощает архитектуру и избавляет от необходимости синхронизации двух таблиц.

## Проблема

Ранее в системе существовали две таблицы:

1. **zakaz_addresses** - справочник всех адресов города
   - Использовалась для привязки заявок к формализованным адресам
   - Содержала только базовую информацию: street, house, comment

2. **zakaz_nodes** - узлы подключения в сети
   - Содержала информацию о точках присутствия компании
   - Имела собственное поле `address` (текстовое)

Это создавало проблемы:
- Дублирование адресов в двух таблицах
- Необходимость синхронизации данных
- Сложность в понимании: где присутствует компания, а где просто есть адрес
- Две точки правды для одних и тех же данных

## Решение

### Концепция: Единая таблица адресов с типом присутствия

Теперь `zakaz_nodes` становится **единым источником правды** для всех адресов в системе. Каждый адрес имеет тип присутствия компании:

```
┌─────────────────────┐
│   zakaz_nodes       │
│  (Все адреса)       │
└─────────────────────┘
         │
         ├─ has_node (Есть узел - ПП, активное оборудование)
         ├─ has_ao (Есть АО - автономный объект)
         ├─ has_transit_cable (Есть транзитный кабель)
         └─ not_present (Не присутствуем, но адрес в системе)
```

### Типы присутствия

#### 1. **has_node** (Есть узел)
Полноценная точка подключения с активным оборудованием:
- Примеры: ПП1869-1, ДО-ЛС42
- Есть коммутационное оборудование
- Можно подключать клиентов

#### 2. **has_ao** (Есть АО)
Автономный объект:
- Примеры: АО1372, АО2145
- Обычно крупный объект (БЦ, ТЦ, завод)
- Может иметь собственную инфраструктуру

#### 3. **has_transit_cable** (Есть транзитный кабель)
Через адрес проходит кабель, но нет оборудования:
- Кабель проложен через подвал/по фасаду
- Техническая возможность подключения есть
- Но нет активного узла

#### 4. **not_present** (Не присутствуем)
Адрес есть в системе (были заявки), но инфраструктуры нет:
- Обычно адреса из заявок, куда еще не дотянулись
- Потенциальные точки расширения сети
- Для статистики и планирования

## Архитектура после миграции

### Структура таблицы zakaz_nodes

```sql
CREATE TABLE zakaz_nodes (
  id BIGSERIAL PRIMARY KEY,

  -- Идентификация
  code VARCHAR(50) NOT NULL UNIQUE,  -- ПП1869-1, АО1372, ADDR-abc123

  -- Адрес (структурированный)
  street VARCHAR(500),                -- ул. Ленина
  house VARCHAR(50),                  -- 5
  address TEXT NOT NULL,              -- ул. Ленина, 5 (полный адрес)
  comment TEXT,                       -- Дополнительная информация

  -- Тип присутствия (НОВОЕ!)
  presence_type presence_type NOT NULL DEFAULT 'has_node',

  -- Техническая информация (для узлов)
  node_type node_type DEFAULT 'other',
  location_details TEXT,              -- Подробное расположение
  comm_info TEXT,                     -- Коммутационная информация

  -- Статус
  status node_status DEFAULT 'existing',
  contract_link TEXT,
  node_created_date DATE,

  -- Служебные поля
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Связь с заявками

**До миграции:**
```
zakaz_applications.address_id → zakaz_addresses.id
```

**После миграции:**
```
zakaz_applications.node_id → zakaz_nodes.id
```

Теперь заявка напрямую связана с адресом, который может иметь любой тип присутствия.

## Процесс миграции

### Этап 1: Создание типа presence_type
```sql
CREATE TYPE presence_type AS ENUM (
  'has_node',
  'has_ao',
  'has_transit_cable',
  'not_present'
);
```

### Этап 2: Расширение zakaz_nodes
Добавляем поля:
- `street` - название улицы
- `house` - номер дома
- `comment` - комментарий
- `presence_type` - тип присутствия

### Этап 3: Обновление существующих узлов
Для существующих записей в `zakaz_nodes` устанавливаем `presence_type`:
- `node_type = 'ao'` → `presence_type = 'has_ao'`
- Остальные → `presence_type = 'has_node'`

### Этап 4: Перенос данных из zakaz_addresses
Все адреса из `zakaz_addresses` переносятся в `zakaz_nodes` с:
- `code = 'ADDR-<short-uuid>'`
- `presence_type = 'not_present'`
- `status = 'existing'`

Создается временный маппинг старых ID на новые.

### Этап 5: Обновление ссылок в zakaz_applications
- Добавляется колонка `node_id`
- Ссылки обновляются через маппинг
- Создается FK constraint
- Удаляется старая колонка `address_id`

### Этап 6: Очистка
- Удаляется таблица `zakaz_addresses`
- Удаляется временный маппинг

### Этап 7: Индексы
Создаются индексы для быстрого поиска:
- По street + house
- По presence_type
- Полнотекстовые индексы для fuzzy search
- Комбинированный индекс

## Применение миграции

### Через psql (рекомендуется для продакшена):

```bash
# 1. Создайте бэкап БД перед миграцией!
pg_dump -U user -d zakaz > backup_before_024.sql

# 2. Примените миграцию
psql -U user -d zakaz -f database/migrations/024_merge_addresses_into_nodes.sql

# 3. Проверьте результат (см. раздел "Проверка" ниже)
```

### Через Supabase Dashboard:

1. SQL Editor → New query
2. Скопируйте содержимое `024_merge_addresses_into_nodes.sql`
3. Run
4. Проверьте логи выполнения

## Проверка после миграции

### 1. Проверка структуры таблицы:
```sql
\d zakaz_nodes
```

Должны быть видны новые колонки: `street`, `house`, `comment`, `presence_type`

### 2. Проверка переноса данных:
```sql
-- Подсчет записей по типам присутствия
SELECT presence_type, COUNT(*) as count
FROM zakaz_nodes
GROUP BY presence_type;
```

Должно быть что-то вроде:
```
 presence_type    | count
------------------+-------
 has_node         |    15
 has_ao           |     3
 not_present      |    47
```

### 3. Проверка связей с заявками:
```sql
-- Все ли заявки успешно привязаны?
SELECT
  COUNT(*) FILTER (WHERE node_id IS NOT NULL) as with_node,
  COUNT(*) FILTER (WHERE node_id IS NULL) as without_node
FROM zakaz_applications;
```

### 4. Проверка индексов:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'zakaz_nodes';
```

### 5. Проверка, что zakaz_addresses удалена:
```sql
SELECT * FROM zakaz_addresses;
-- Должно выдать: ERROR: relation "zakaz_addresses" does not exist
```

## Изменения в коде

### TypeScript типы (lib/types.ts)

**БЫЛО:**
```typescript
export interface Node {
  id: string
  code: string
  node_type: NodeType
  address: string
  // ...
}
```

**СТАЛО:**
```typescript
export type PresenceType = 'has_node' | 'has_ao' | 'has_transit_cable' | 'not_present'

export interface Node {
  id: string
  code: string
  node_type: NodeType

  // Структурированный адрес
  street: string | null
  house: string | null
  address: string
  comment: string | null

  // Тип присутствия
  presence_type: PresenceType

  // ...остальные поля
}

// Интерфейс Address больше не нужен - удален!
```

### API endpoints

#### Удалить:
- ❌ `/api/addresses/*` - все endpoints для работы с addresses
- ❌ `/api/admin/addresses/*` - админка адресов

#### Обновить:
- ✅ `/api/applications/*` - заменить `address_id` на `node_id`
- ✅ `/api/nodes/*` - добавить фильтрацию по `presence_type`

#### Создать новые:
- ✅ `/api/nodes/search` - поиск адресов (вместо /api/addresses/search)
- ✅ `/api/nodes?presence_type=not_present` - фильтр по типу

### UI компоненты

#### Обновить:
1. **Мастер привязки адресов** (`AddressLinkWizard.tsx`)
   - Переименовать в `NodeLinkWizard.tsx`
   - Использовать `/api/nodes/search` вместо `/api/addresses/search`
   - Обновить поле `node_id` вместо `address_id`

2. **Карточка заявки** (`ApplicationCard.tsx`)
   - Заменить `address_id` на `node_id`
   - Показывать тип присутствия (иконку или бейдж)

3. **Список адресов** (админка)
   - Переименовать в "Узлы и адреса"
   - Добавить фильтр по `presence_type`
   - Показывать тип присутствия в списке

4. **Форма создания узла**
   - Добавить выбор `presence_type`
   - Добавить поля `street` и `house` (опционально)

## Примеры использования

### Создание нового узла:
```typescript
const newNode = {
  code: 'ПП2000-1',
  street: 'ул. Ленина',
  house: '10',
  address: 'ул. Ленина, 10',
  presence_type: 'has_node',
  node_type: 'pp',
  location_details: 'Подвал, 1 этаж',
  comm_info: 'MikroTik RB4011, 12 портов',
  status: 'existing'
}
```

### Создание адреса без узла:
```typescript
const addressOnly = {
  code: 'ADDR-' + generateShortId(),
  street: 'ул. Пушкина',
  house: '25',
  address: 'ул. Пушкина, 25',
  presence_type: 'not_present',
  status: 'existing'
}
```

### Поиск узлов с оборудованием:
```sql
SELECT * FROM zakaz_nodes
WHERE presence_type IN ('has_node', 'has_ao')
AND status = 'existing';
```

### Поиск адресов для потенциального расширения:
```sql
SELECT
  n.street,
  n.house,
  COUNT(a.id) as applications_count
FROM zakaz_nodes n
LEFT JOIN zakaz_applications a ON a.node_id = n.id
WHERE n.presence_type = 'not_present'
GROUP BY n.id, n.street, n.house
HAVING COUNT(a.id) > 3  -- Много заявок, но нет узла
ORDER BY applications_count DESC;
```

## Откат (Rollback)

⚠️ **ВНИМАНИЕ:** Откат этой миграции возможен **только если есть полный бэкап** базы данных до применения миграции!

Миграция является **необратимой** (destructive), так как:
1. Удаляется таблица `zakaz_addresses`
2. Удаляется колонка `address_id` из `zakaz_applications`
3. Данные переносятся и трансформируются

### Если нужно откатить (из бэкапа):

```bash
# 1. Остановить приложение
systemctl stop zakaz-app

# 2. Восстановить БД из бэкапа
psql -U user -d zakaz < backup_before_024.sql

# 3. Откатить изменения в коде (git)
git revert <commit-hash-with-migration-024-changes>

# 4. Запустить приложение
systemctl start zakaz-app
```

## Преимущества новой архитектуры

✅ **Единый источник правды** - все адреса в одной таблице
✅ **Нет дублирования** - не нужно синхронизировать две таблицы
✅ **Понятная классификация** - сразу видно, где есть инфраструктура
✅ **Гибкость** - можно легко добавить новые типы присутствия
✅ **Планирование** - легко найти адреса для расширения сети
✅ **Статистика** - простые запросы для аналитики

## Мониторинг

После применения миграции отслеживать:

```sql
-- Статистика по типам присутствия
SELECT
  presence_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'existing') as existing,
  COUNT(*) FILTER (WHERE status = 'planned') as planned
FROM zakaz_nodes
GROUP BY presence_type;

-- Адреса с большим количеством заявок, но без узла
SELECT
  n.street,
  n.house,
  n.presence_type,
  COUNT(a.id) as apps
FROM zakaz_nodes n
LEFT JOIN zakaz_applications a ON a.node_id = n.id
WHERE n.presence_type = 'not_present'
GROUP BY n.id
HAVING COUNT(a.id) > 2
ORDER BY apps DESC;
```

## Changelog

- **2025-11-24**: Создание миграции 024
- Объединение zakaz_addresses и zakaz_nodes
- Добавление presence_type enum
- Обновление связей в zakaz_applications

---

**Вопросы и проблемы:** Если возникли проблемы при применении миграции, проверьте логи Supabase и убедитесь, что все предыдущие миграции применены успешно.
