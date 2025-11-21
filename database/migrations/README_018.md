# Миграция 018: Создание таблицы узлов подключения

## Дата
2025-11-21

## Описание
Создание таблицы `zakaz_nodes` для хранения информации об узлах подключения в сети. Узлы - это точки подключения (коммутаторы, распределительные шкафы), к которым подключаются клиенты.

## Изменения

### Новые типы данных

1. **node_status** - статус узла
   - `existing` - Существующий (узел уже установлен и работает)
   - `planned` - Проектируемый (узел планируется к установке)

2. **node_type** - тип узла
   - `pp` - ПП (Промежуточный пункт)
   - `ao` - АО (Абонентский отдел)
   - `do_ls` - ДО-ЛС (Домовой отдел - Линейные сооружения)
   - `other` - Другое

### Новая таблица: zakaz_nodes

| Поле | Тип | Описание |
|------|-----|----------|
| id | BIGSERIAL | Первичный ключ |
| code | VARCHAR(50) | Уникальный код узла (ПП1869-1, АО1372 и т.д.) |
| node_type | node_type | Тип узла (автоматически определяется из кода) |
| address | TEXT | Адрес узла |
| location_details | TEXT | Подробное описание местоположения (подъезд, этаж, организация) |
| comm_info | TEXT | Коммутационная информация (порты, подключения) |
| status | node_status | Статус узла (existing/planned) |
| contract_link | TEXT | Ссылка на договор |
| node_created_date | DATE | Дата создания узла в реальности |
| created_by | VARCHAR(255) | Кто создал запись |
| created_at | TIMESTAMP | Дата создания записи |
| updated_by | VARCHAR(255) | Кто обновил запись |
| updated_at | TIMESTAMP | Дата обновления записи |

### Индексы

- `idx_nodes_code` - индекс по коду узла
- `idx_nodes_status` - индекс по статусу
- `idx_nodes_node_type` - индекс по типу узла
- `idx_nodes_address` - полнотекстовый индекс по адресу (GIN, русский язык)

### Триггеры

1. **trigger_update_nodes_updated_at** - автоматическое обновление поля `updated_at` при изменении записи

2. **trigger_set_node_type** - автоматическое определение типа узла по коду:
   - Код начинается с "ПП" → тип `pp`
   - Код начинается с "АО" → тип `ao`
   - Код начинается с "ДО-ЛС" или "ДО_ЛС" → тип `do_ls`
   - Иначе → тип `other`

## Применение миграции

### Автоматически
```bash
./database/apply-migration-018.sh
```

### Вручную
```bash
psql $SUPABASE_DB_URL -f database/migrations/018_create_nodes_table.sql
```

## Откат миграции

```sql
-- Удаление таблицы и связанных объектов
DROP TABLE IF EXISTS zakaz_nodes CASCADE;
DROP TYPE IF EXISTS node_status CASCADE;
DROP TYPE IF EXISTS node_type CASCADE;
DROP FUNCTION IF EXISTS update_nodes_updated_at() CASCADE;
DROP FUNCTION IF EXISTS set_node_type_from_code() CASCADE;
```

## Импорт данных из Excel

После применения миграции можно импортировать узлы из Excel файла через веб-интерфейс:

1. Перейдите на страницу `/dashboard/nodes`
2. Нажмите кнопку "Импорт из Excel"
3. Выберите Excel файл (.xlsx или .xls)

### Формат Excel файла

Файл должен содержать следующие колонки (заголовки на русском):

| Колонка | Обязательное | Описание | Пример |
|---------|--------------|----------|--------|
| ID | Нет | Идентификатор (игнорируется при импорте) | 20350 |
| Код | **Да** | Уникальный код узла | ПП1869-1, АО1372 |
| Адрес | **Да** | Адрес узла | г. Томск, ул. Дзержинского, д. 346 |
| Местоположение | Нет | Детали местоположения | 2 подъезд, 2 этаж |
| Ком.информация | Нет | Коммутационная информация | Включен с Федора Лыткина, 12/1 s734-1-2 порт 10 |
| Статус | Нет | Статус узла | Существующий / Проектируемый |
| Договор | Нет | Ссылка на договор | - |
| Дата создания | Нет | Дата создания узла | 20.11.2025 |

### Обработка при импорте

- Коды очищаются от гиперссылок и специальных символов
- Дубликаты кодов пропускаются
- Статус "Существующий" → `existing`, "Проектируемый" → `planned`
- Тип узла определяется автоматически по коду
- Импорт происходит партиями по 100 записей для оптимизации

### API для импорта

```bash
curl -X POST http://localhost:3000/api/nodes/import \
  -H "Content-Type: multipart/form-data" \
  -F "file=@nodes.xlsx"
```

Ответ:
```json
{
  "success": true,
  "message": "Import completed: 2000 nodes imported",
  "stats": {
    "total": 2050,
    "inserted": 2000,
    "skipped": 45,
    "errors": 5
  },
  "details": {
    "skipped": [...],
    "errors": [...]
  }
}
```

## TypeScript типы

Добавлены следующие типы в `lib/types.ts`:

```typescript
export type NodeStatus = 'existing' | 'planned'
export type NodeType = 'pp' | 'ao' | 'do_ls' | 'other'

export interface Node {
  id: string
  code: string
  node_type: NodeType
  address: string
  location_details: string | null
  comm_info: string | null
  status: NodeStatus
  contract_link: string | null
  node_created_date: string | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string
}
```

## API Endpoints

### GET /api/nodes
Получение списка узлов с фильтрацией и пагинацией

**Параметры:**
- `page` - номер страницы (по умолчанию: 1)
- `limit` - количество записей на странице (по умолчанию: 50)
- `status` - фильтр по статусу (existing/planned)
- `node_type` - фильтр по типу узла
- `search` - поиск по коду, адресу или описанию

**Пример:**
```bash
GET /api/nodes?status=existing&search=ПП1869
```

### POST /api/nodes
Создание нового узла

**Тело запроса:**
```json
{
  "code": "ПП1869-1",
  "address": "г. Томск, ул. Дзержинского, д. 346",
  "location_details": "2 подъезд, 2 этаж",
  "comm_info": "Порт 10",
  "status": "existing",
  "contract_link": null,
  "node_created_date": "2025-11-20"
}
```

### POST /api/nodes/import
Импорт узлов из Excel файла

**Параметры:**
- `file` - Excel файл (.xlsx или .xls)

**Доступ:** только для администраторов

## Связанные файлы

- Миграция: `database/migrations/018_create_nodes_table.sql`
- Скрипт применения: `database/apply-migration-018.sh`
- TypeScript типы: `lib/types.ts`
- API endpoints:
  - `app/api/nodes/route.ts`
  - `app/api/nodes/import/route.ts`
- UI: `app/dashboard/nodes/page.tsx`

## Примечания

1. Таблица узлов независима от таблицы заявок (`zakaz_applications`)
2. В будущем можно добавить связь между узлами и заявками через поле `node_id` в таблице заявок
3. Импорт поддерживает большие файлы (2000+ записей) благодаря пакетной вставке
4. Полнотекстовый поиск по адресам оптимизирован для русского языка
